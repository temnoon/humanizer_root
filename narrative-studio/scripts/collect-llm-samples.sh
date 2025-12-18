#!/bin/bash
#
# Interactive LLM Sample Collection Script
# Displays prompts for copy/paste, collects responses into JSON
#

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DATA_DIR="$SCRIPT_DIR/../data"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'
BOLD='\033[1m'

# Prompt data
declare -a PROMPT_IDS=("N1" "N2" "N3" "G1" "G2" "G3" "A1" "A2" "A3" "E1" "E2" "E3" "M1" "M2" "M3")
declare -a GENRES=("narrative" "narrative" "narrative" "gothic" "gothic" "gothic" "adventure" "adventure" "adventure" "argument" "argument" "argument" "memoir" "memoir" "memoir")

declare -a PROMPTS=(
"Write the opening scene of a novel. A woman in her thirties arrives at her childhood home after many years away. The house has been sold and she has one day to collect what remains of her family's belongings. Begin as she approaches the house. Approximately 800 words."

"Write a scene from a novel. Two old friends meet by chance at a train station. One is departing, the other arriving. They have not spoken in years due to a falling out over a business venture. Write their conversation and its aftermath. Approximately 800 words."

"Write a scene from a novel. A middle-aged man sits in a hospital waiting room while his father undergoes surgery. He reflects on their relationship while observing other families around him. Approximately 800 words."

"Write a passage in the Gothic tradition. A scholar discovers a hidden chamber in an old library that contains manuscripts no one has read in centuries. As they begin to read, they realize the texts describe events that have not yet occurred. Approximately 800 words."

"Write a passage in the Gothic tradition. A woman inherits a house in a coastal village. The locals refuse to speak of its history. On her first night, she hears sounds from a room that, according to the floor plans, should not exist. Approximately 800 words."

"Write a passage in the Gothic tradition. A portrait painter is commissioned to create a likeness of an elderly aristocrat. During their sessions, the subject tells stories that seem impossible—events from centuries past, described as firsthand experience. Approximately 800 words."

"Write an adventure narrative. A ship captain navigates through a dangerous strait during a storm. The crew must make split-second decisions as cargo shifts and rigging fails. Describe the physical struggle against the elements. Approximately 800 words."

"Write an adventure narrative. An expedition into unmapped jungle discovers ruins of a civilization unknown to history. As they explore deeper, they realize they are not alone. Write their first encounter with the ruins' guardians. Approximately 800 words."

"Write an adventure narrative. A pilot crash-lands in mountainous terrain. With limited supplies and an injured passenger, they must find a path to safety before winter storms arrive. Describe the first day's journey. Approximately 800 words."

"Write a philosophical essay arguing a position on this question: Is certainty a virtue or a liability in intellectual life? Take a clear stance and defend it with examples and reasoning. Approximately 800 words."

"Write a philosophical essay arguing a position on this question: Do we have stronger obligations to those near to us than to strangers? Take a clear stance and defend it with examples and reasoning. Approximately 800 words."

"Write a philosophical essay arguing a position on this question: Is the examined life worth living if the examination reveals truths we cannot change? Take a clear stance and defend it with examples and reasoning. Approximately 800 words."

"Write a personal essay about a moment when you realized a long-held belief was wrong. Describe the context, the realization, and its aftermath. Use specific sensory details and emotional honesty. Approximately 800 words."

"Write a personal essay about a place that shaped who you are. It might be a childhood home, a city you lived in, or somewhere you visited briefly but never forgot. Ground abstract reflections in concrete details. Approximately 800 words."

"Write a personal essay about a skill or practice you learned later in life than most. What was difficult about it? What did it reveal about yourself? Approximately 800 words."
)

# Main
main() {
    echo -e "${BOLD}${CYAN}"
    echo "╔═══════════════════════════════════════════════════════════════╗"
    echo "║       SIC Multi-Model Sample Collection Script                ║"
    echo "╚═══════════════════════════════════════════════════════════════╝"
    echo -e "${NC}"
    echo
    echo "This script will guide you through collecting LLM samples."
    echo "You'll copy prompts into the LLM and paste responses back."
    echo
    echo -e "${YELLOW}Select model to collect samples for:${NC}"
    echo "  1) GPT-5.2 (ChatGPT)"
    echo "  2) Gemini 3 Pro"
    echo "  3) Llama 3.1 70B (via local API)"
    echo "  4) Llama 3.1 8B (via local API)"
    echo "  5) Mistral 7B (via local API)"
    echo "  q) Quit"
    echo
    read -p "Choice [1-5, q]: " choice

    local model=""
    local model_display=""
    case $choice in
        1) model="gpt52"; model_display="GPT-5.2" ;;
        2) model="gemini3"; model_display="GEMINI 3 PRO" ;;
        3) model="llama70"; model_display="LLAMA 70B" ;;
        4) model="llama8"; model_display="LLAMA 8B" ;;
        5) model="mistral"; model_display="MISTRAL 7B" ;;
        q|Q) echo "Exiting."; exit 0 ;;
        *) echo "Invalid choice"; exit 1 ;;
    esac

    # Create persistent temp directory for this collection
    local work_dir="$DATA_DIR/.collecting-${model}"
    mkdir -p "$work_dir"

    # Check if there's a partial collection
    local start_index=0
    if [ -f "$work_dir/progress" ]; then
        start_index=$(cat "$work_dir/progress")
        echo
        echo -e "${YELLOW}Found partial collection at prompt $((start_index + 1))${NC}"
        read -p "Resume from where you left off? [Y/n]: " resume
        if [ "$resume" = "n" ] || [ "$resume" = "N" ]; then
            rm -rf "$work_dir"
            mkdir -p "$work_dir"
            start_index=0
        fi
    fi

    local output_file="$DATA_DIR/sic-${model}-samples.json"

    # Check if final file already exists
    if [ -f "$output_file" ] && [ $start_index -eq 0 ]; then
        echo
        echo -e "${RED}Warning: ${output_file} already exists!${NC}"
        read -p "Overwrite? [y/N]: " overwrite
        if [ "$overwrite" != "y" ] && [ "$overwrite" != "Y" ]; then
            echo "Exiting."
            exit 0
        fi
    fi

    local total=${#PROMPTS[@]}

    # Collect responses
    for i in $(seq $start_index $((total - 1))); do
        local current=$((i + 1))
        local response_file="$work_dir/response_${i}.txt"

        clear
        echo -e "${BOLD}${CYAN}═══════════════════════════════════════════════════════════════${NC}"
        echo -e "${BOLD}  SIC Sample Collection - ${model_display}${NC}"
        echo -e "${CYAN}═══════════════════════════════════════════════════════════════${NC}"
        echo
        echo -e "${YELLOW}Prompt ID:${NC} ${PROMPT_IDS[$i]} (${GENRES[$i]})"
        echo -e "${YELLOW}Progress:${NC} ${current}/${total}"
        echo
        echo -e "${BOLD}${GREEN}╔═══════════════════════════════════════════════════════════════╗${NC}"
        echo -e "${BOLD}${GREEN}║  COPY THIS PROMPT INTO ${model_display}:${NC}"
        echo -e "${BOLD}${GREEN}╚═══════════════════════════════════════════════════════════════╝${NC}"
        echo
        echo "${PROMPTS[$i]}"
        echo
        echo -e "${BOLD}${GREEN}════════════════════════════════════════════════════════════════${NC}"
        echo
        echo -e "${YELLOW}After ${model_display} generates a response:${NC}"
        echo -e "  1. Copy the ENTIRE response"
        echo -e "  2. Paste it below"
        echo -e "  3. Press ${BOLD}Enter${NC}, then ${BOLD}Ctrl+D${NC} when done"
        echo
        echo -e "${CYAN}Paste response now (Ctrl+D to finish):${NC}"
        echo -e "${BLUE}───────────────────────────────────────────────────────────────${NC}"

        # Read multiline input directly to file
        cat > "$response_file"

        echo -e "${BLUE}───────────────────────────────────────────────────────────────${NC}"

        local word_count=$(wc -w < "$response_file" | tr -d ' ')
        echo
        echo -e "${GREEN}✓ Captured ${word_count} words${NC}"
        echo -e "${GREEN}✓ Saved to ${response_file}${NC}"

        # Save progress
        echo $((i + 1)) > "$work_dir/progress"

        if [ $current -lt $total ]; then
            echo
            read -p "Press Enter for next prompt (or 'q' to save and quit): " cont
            if [ "$cont" = "q" ] || [ "$cont" = "Q" ]; then
                echo
                echo -e "${YELLOW}Progress saved. Run script again to resume.${NC}"
                exit 0
            fi
        fi
    done

    # All responses collected - now build JSON with Python
    echo
    echo -e "${CYAN}Building JSON file...${NC}"

    python3 - "$work_dir" "$output_file" "$model" << 'PYTHON_SCRIPT'
import json
import os
import sys
from datetime import datetime, timezone

work_dir = sys.argv[1]
output_file = sys.argv[2]
model = sys.argv[3]

prompt_ids = ["N1", "N2", "N3", "G1", "G2", "G3", "A1", "A2", "A3", "E1", "E2", "E3", "M1", "M2", "M3"]
genres = ["narrative", "narrative", "narrative", "gothic", "gothic", "gothic", "adventure", "adventure", "adventure", "argument", "argument", "argument", "memoir", "memoir", "memoir"]

prompts = [
    "Write the opening scene of a novel. A woman in her thirties arrives at her childhood home after many years away. The house has been sold and she has one day to collect what remains of her family's belongings. Begin as she approaches the house. Approximately 800 words.",
    "Write a scene from a novel. Two old friends meet by chance at a train station. One is departing, the other arriving. They have not spoken in years due to a falling out over a business venture. Write their conversation and its aftermath. Approximately 800 words.",
    "Write a scene from a novel. A middle-aged man sits in a hospital waiting room while his father undergoes surgery. He reflects on their relationship while observing other families around him. Approximately 800 words.",
    "Write a passage in the Gothic tradition. A scholar discovers a hidden chamber in an old library that contains manuscripts no one has read in centuries. As they begin to read, they realize the texts describe events that have not yet occurred. Approximately 800 words.",
    "Write a passage in the Gothic tradition. A woman inherits a house in a coastal village. The locals refuse to speak of its history. On her first night, she hears sounds from a room that, according to the floor plans, should not exist. Approximately 800 words.",
    "Write a passage in the Gothic tradition. A portrait painter is commissioned to create a likeness of an elderly aristocrat. During their sessions, the subject tells stories that seem impossible—events from centuries past, described as firsthand experience. Approximately 800 words.",
    "Write an adventure narrative. A ship captain navigates through a dangerous strait during a storm. The crew must make split-second decisions as cargo shifts and rigging fails. Describe the physical struggle against the elements. Approximately 800 words.",
    "Write an adventure narrative. An expedition into unmapped jungle discovers ruins of a civilization unknown to history. As they explore deeper, they realize they are not alone. Write their first encounter with the ruins' guardians. Approximately 800 words.",
    "Write an adventure narrative. A pilot crash-lands in mountainous terrain. With limited supplies and an injured passenger, they must find a path to safety before winter storms arrive. Describe the first day's journey. Approximately 800 words.",
    "Write a philosophical essay arguing a position on this question: Is certainty a virtue or a liability in intellectual life? Take a clear stance and defend it with examples and reasoning. Approximately 800 words.",
    "Write a philosophical essay arguing a position on this question: Do we have stronger obligations to those near to us than to strangers? Take a clear stance and defend it with examples and reasoning. Approximately 800 words.",
    "Write a philosophical essay arguing a position on this question: Is the examined life worth living if the examination reveals truths we cannot change? Take a clear stance and defend it with examples and reasoning. Approximately 800 words.",
    "Write a personal essay about a moment when you realized a long-held belief was wrong. Describe the context, the realization, and its aftermath. Use specific sensory details and emotional honesty. Approximately 800 words.",
    "Write a personal essay about a place that shaped who you are. It might be a childhood home, a city you lived in, or somewhere you visited briefly but never forgot. Ground abstract reflections in concrete details. Approximately 800 words.",
    "Write a personal essay about a skill or practice you learned later in life than most. What was difficult about it? What did it reveal about yourself? Approximately 800 words."
]

samples = []
for i in range(15):
    response_file = os.path.join(work_dir, f"response_{i}.txt")
    if os.path.exists(response_file):
        with open(response_file, 'r', encoding='utf-8') as f:
            text = f.read().strip()
        if text:
            samples.append({
                "id": f"{model}_{prompt_ids[i]}",
                "source": model,
                "genre": genres[i],
                "prompt_id": prompt_ids[i],
                "prompt": prompts[i],
                "text": text,
                "word_count": len(text.split()),
                "generated_at": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
            })

if len(samples) < 15:
    print(f"Warning: Only {len(samples)} samples found, expected 15")
    sys.exit(1)

data = {
    "metadata": {
        "version": "1.0",
        "generated": datetime.now(timezone.utc).strftime("%Y-%m-%d"),
        "source": model,
        "model_id": model,
        "protocol": "SIC_MULTIMODEL_TEST_PROTOCOL.md"
    },
    "samples": samples
}

os.makedirs(os.path.dirname(output_file), exist_ok=True)
with open(output_file, 'w', encoding='utf-8') as f:
    json.dump(data, f, indent=2, ensure_ascii=False)

print(f"Successfully saved {len(samples)} samples to {output_file}")
PYTHON_SCRIPT

    if [ $? -eq 0 ]; then
        # Clean up work directory on success
        rm -rf "$work_dir"

        echo
        echo -e "${GREEN}${BOLD}════════════════════════════════════════════════════════════════${NC}"
        echo -e "${GREEN}${BOLD}  Collection complete!${NC}"
        echo -e "${GREEN}${BOLD}════════════════════════════════════════════════════════════════${NC}"
        echo
        echo "File saved to: $output_file"
        echo
        echo "Run again to collect samples for another model."
    else
        echo
        echo -e "${RED}Error saving JSON. Your responses are preserved in:${NC}"
        echo "$work_dir"
        echo
        echo -e "${YELLOW}Run the script again to retry or contact support.${NC}"
    fi
}

main "$@"
