# Node.js Version 22 - Quick Reference

**Status:** ✅ FIXED (Nov 9, 2025)
**Default:** v22.21.1 (system-wide)

---

## 🚀 Quick Checks

```bash
# Should always show v22.21.1
node --version
nvm current
nvm alias default

# Run comprehensive tests
/Users/tem/humanizer_root/verify-node-version.sh
```

---

## 🔧 If Old Shell Needs Update

```bash
# Zsh
source ~/.zshrc

# Bash
source ~/.bashrc

# Or just open a new terminal
```

---

## 📁 Files Modified

All shell configs now have NVM initialization:

- `~/.zshrc` - Main zsh config + auto-load .nvmrc on cd
- `~/.zprofile` - Zsh login shells
- `~/.bashrc` - Bash interactive shells
- `~/.bash_profile` - Bash login shells (Volta disabled)

All project roots have .nvmrc files:

- `/Users/tem/humanizer_root/.nvmrc` → `22`
- `/Users/tem/humanizer_root/cloud-workbench/.nvmrc` → `22`
- `/Users/tem/humanizer_root/workers/npe-api/.nvmrc` → `22`
- `/Users/tem/humanizer_root/frontend/.nvmrc` → `22`
- `/Users/tem/humanizer_root/cloud-frontend/.nvmrc` → `22`

---

## ⚠️ Important Changes

1. **Volta Disabled:** Conflicted with NVM, now commented out
2. **Homebrew Node Overridden:** Still installed (v23), but NVM takes precedence
3. **Auto-Load .nvmrc:** Zsh automatically switches versions when you cd

---

## 🆘 Emergency Reset

```bash
# If completely broken
nvm use 22              # Immediate fix
nvm alias default 22    # Set default
source ~/.zshrc         # Reload config
```

---

## 📖 Full Documentation

See: `/Users/tem/humanizer_root/NODE_VERSION_FIX_DOCUMENTATION.md`

**Test Script:** `/Users/tem/humanizer_root/verify-node-version.sh`
