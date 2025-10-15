"""
Live ChatGPT Capture API

Endpoints for capturing live ChatGPT conversations from browser extension:
- POST /api/capture/conversation - Create or update conversation metadata
- POST /api/capture/message - Add message to conversation
- POST /api/capture/media - Upload media file (images, attachments)
- GET /api/capture/status/{conversation_uuid} - Check capture status
"""

from uuid import UUID
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from pathlib import Path
import shutil
import mimetypes

from humanizer.database import get_session
from humanizer.models.chatgpt import (
    ChatGPTConversation,
    ChatGPTMessage,
    ChatGPTMedia,
    ChatGPTProvenance,
)
from humanizer.models.schemas import (
    CaptureConversationRequest,
    CaptureConversationResponse,
    CaptureMessageRequest,
    CaptureMessageResponse,
    CaptureMediaResponse,
    CaptureStatusResponse,
)

router = APIRouter(prefix="/api/capture", tags=["capture"])

# Media storage directory
MEDIA_DIR = Path("/Users/tem/humanizer_root/humanizer/media/captured")
MEDIA_DIR.mkdir(parents=True, exist_ok=True)


@router.post("/conversation", response_model=CaptureConversationResponse)
async def capture_conversation(
    request: CaptureConversationRequest,
    session: AsyncSession = Depends(get_session),
):
    """
    Create or update a live-captured conversation.

    If conversation exists, updates metadata (title, timestamps, URL).
    If new, creates conversation with source='live_capture'.

    Args:
        request: Conversation metadata (uuid, title, url, timestamps, etc.)

    Returns:
        CaptureConversationResponse with conversation_id and status
    """
    try:
        # Check if conversation exists
        stmt = select(ChatGPTConversation).where(
            ChatGPTConversation.uuid == request.uuid
        )
        result = await session.execute(stmt)
        conversation = result.scalar_one_or_none()

        now = datetime.utcnow()

        if conversation:
            # Update existing conversation
            conversation.title = request.title or conversation.title
            conversation.updated_at = now

            # Update metadata with source URL
            metadata = conversation.custom_metadata or {}
            metadata.update({
                "source": "live_capture",
                "source_url": request.source_url,
                "last_captured": now.isoformat(),
                "model_slug": request.model_slug,
            })
            conversation.custom_metadata = metadata

            status_msg = "updated"
        else:
            # Create new conversation
            conversation = ChatGPTConversation(
                uuid=request.uuid,
                title=request.title or "Untitled",
                created_at=request.created_at or now,
                updated_at=now,
                source_archive="live_capture",
                custom_metadata={
                    "source": "live_capture",
                    "source_url": request.source_url,
                    "last_captured": now.isoformat(),
                    "model_slug": request.model_slug,
                    "conversation_id": str(request.uuid),
                }
            )
            session.add(conversation)

            # Create provenance record
            provenance = ChatGPTProvenance(
                conversation_uuid=request.uuid,
                archive_name="live_capture",
                archive_date=now,
                message_count=0,
            )
            session.add(provenance)

            status_msg = "created"

        await session.commit()

        return CaptureConversationResponse(
            conversation_id=str(conversation.uuid),
            status=status_msg,
            message=f"Conversation {status_msg} successfully"
        )

    except Exception as e:
        await session.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to capture conversation: {str(e)}"
        )


@router.post("/message", response_model=CaptureMessageResponse)
async def capture_message(
    request: CaptureMessageRequest,
    session: AsyncSession = Depends(get_session),
):
    """
    Add a message to a live-captured conversation.

    Creates message if it doesn't exist (by UUID).
    Updates existing message if already captured.

    Args:
        request: Message data (uuid, conversation_uuid, role, content, etc.)

    Returns:
        CaptureMessageResponse with message_id and status
    """
    try:
        # Verify conversation exists
        stmt = select(ChatGPTConversation).where(
            ChatGPTConversation.uuid == request.conversation_uuid
        )
        result = await session.execute(stmt)
        conversation = result.scalar_one_or_none()

        if not conversation:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Conversation {request.conversation_uuid} not found. Capture conversation first."
            )

        # Check if message exists
        msg_stmt = select(ChatGPTMessage).where(
            ChatGPTMessage.uuid == request.uuid
        )
        msg_result = await session.execute(msg_stmt)
        message = msg_result.scalar_one_or_none()

        if message:
            # Update existing message
            message.content_text = request.content_text
            message.content_parts = request.content_parts or []
            message.custom_metadata.update({
                "updated_at": datetime.utcnow().isoformat(),
            })
            status_msg = "updated"
        else:
            # Create new message
            message = ChatGPTMessage(
                uuid=request.uuid,
                conversation_uuid=request.conversation_uuid,
                created_at=request.created_at or datetime.utcnow(),
                author_role=request.author_role,
                content_text=request.content_text,
                content_parts=request.content_parts or [],
                custom_metadata={
                    "message_id": str(request.uuid),
                    "source": "live_capture",
                    "captured_at": datetime.utcnow().isoformat(),
                }
            )
            session.add(message)
            status_msg = "created"

        await session.commit()

        return CaptureMessageResponse(
            message_id=str(message.uuid),
            status=status_msg,
            message=f"Message {status_msg} successfully"
        )

    except HTTPException:
        raise
    except Exception as e:
        await session.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to capture message: {str(e)}"
        )


@router.post("/media", response_model=CaptureMediaResponse)
async def capture_media(
    file: UploadFile = File(...),
    message_uuid: str = Form(...),
    conversation_uuid: str = Form(...),
    source_url: str = Form(None),
    session: AsyncSession = Depends(get_session),
):
    """
    Upload media file from live capture.

    Saves file to media/captured/ directory and creates database record.
    Associates with specific message.

    Args:
        file: Uploaded file (image, attachment, etc.)
        message_uuid: Message UUID this media belongs to
        conversation_uuid: Conversation UUID
        source_url: Original CDN URL (optional)

    Returns:
        CaptureMediaResponse with file_id and local path
    """
    try:
        # Verify message exists
        msg_uuid = UUID(message_uuid)
        conv_uuid = UUID(conversation_uuid)

        stmt = select(ChatGPTMessage).where(ChatGPTMessage.uuid == msg_uuid)
        result = await session.execute(stmt)
        message = result.scalar_one_or_none()

        if not message:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Message {message_uuid} not found"
            )

        # Generate unique file ID and save file
        timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
        file_ext = Path(file.filename).suffix if file.filename else ""
        file_id = f"captured_{timestamp}_{msg_uuid}{file_ext}"
        file_path = MEDIA_DIR / file_id

        # Save uploaded file
        with file_path.open("wb") as buffer:
            shutil.copyfileobj(file.file, buffer)

        # Detect MIME type
        mime_type = file.content_type or mimetypes.guess_type(str(file_path))[0] or "application/octet-stream"

        # Create media record
        media = ChatGPTMedia(
            file_id=file_id,
            conversation_uuid=conv_uuid,
            message_uuid=msg_uuid,
            file_path=str(file_path),
            source_archive="live_capture",
            mime_type=mime_type,
            file_metadata={
                "original_filename": file.filename,
                "source_url": source_url,
                "captured_at": datetime.utcnow().isoformat(),
                "file_size": file_path.stat().st_size,
            }
        )
        session.add(media)
        await session.commit()

        return CaptureMediaResponse(
            file_id=file_id,
            file_path=str(file_path),
            mime_type=mime_type,
            status="uploaded",
            message=f"Media {file_id} uploaded successfully"
        )

    except HTTPException:
        raise
    except Exception as e:
        await session.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to upload media: {str(e)}"
        )


@router.get("/status/{conversation_uuid}", response_model=CaptureStatusResponse)
async def get_capture_status(
    conversation_uuid: UUID,
    session: AsyncSession = Depends(get_session),
):
    """
    Get capture status for a conversation.

    Returns whether conversation exists, message count, media count, etc.
    Useful for browser extension to check sync status.

    Args:
        conversation_uuid: Conversation UUID to check

    Returns:
        CaptureStatusResponse with conversation status
    """
    try:
        # Get conversation
        stmt = select(ChatGPTConversation).where(
            ChatGPTConversation.uuid == conversation_uuid
        )
        result = await session.execute(stmt)
        conversation = result.scalar_one_or_none()

        if not conversation:
            return CaptureStatusResponse(
                conversation_id=str(conversation_uuid),
                exists=False,
                message_count=0,
                media_count=0,
                last_captured=None,
            )

        # Count messages
        msg_stmt = select(ChatGPTMessage).where(
            ChatGPTMessage.conversation_uuid == conversation_uuid
        )
        msg_result = await session.execute(msg_stmt)
        messages = msg_result.scalars().all()

        # Count media
        media_stmt = select(ChatGPTMedia).where(
            ChatGPTMedia.conversation_uuid == conversation_uuid
        )
        media_result = await session.execute(media_stmt)
        media = media_result.scalars().all()

        # Get last captured timestamp
        last_captured = conversation.custom_metadata.get("last_captured")

        return CaptureStatusResponse(
            conversation_id=str(conversation_uuid),
            exists=True,
            message_count=len(messages),
            media_count=len(media),
            last_captured=last_captured,
        )

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get capture status: {str(e)}"
        )
