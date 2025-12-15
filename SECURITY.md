# Security Best Practices

## API Key Management

### ⚠️ NEVER commit API keys to git!

**DO THIS:**
```bash
# 1. Copy the example file
cp .env.example .env

# 2. Edit .env and add your REAL keys
nano .env  # or use your preferred editor

# 3. Verify .env is in .gitignore
cat .gitignore | grep .env  # Should show ".env"
```

**Your `.env` file should look like:**
```bash
OPENAI_API_KEY=sk-proj-YOUR-ACTUAL-KEY-HERE
ANTHROPIC_API_KEY=sk-ant-YOUR-KEY-IF-YOU-HAVE-IT
GEMINI_API_KEY=YOUR-KEY-IF-YOU-HAVE-IT
DEFAULT_AI_MODE=hybrid
```

### If You Accidentally Exposed a Key

1. **Immediately revoke it:**
   - OpenAI: https://platform.openai.com/api-keys
   - Anthropic: https://console.anthropic.com/settings/keys
   - Google: https://makersuite.google.com/app/apikey

2. **Generate a new key**

3. **Update your `.env` file**

### Checking for Exposed Keys

```bash
# Make sure .env is NOT tracked by git
git status  # Should NOT show .env

# If it shows .env, remove it from git:
git rm --cached .env
git commit -m "Remove accidentally committed .env"
```

## Cost Controls

fe-pilot includes built-in cost controls:

- **Per-test budget:** Aborts if AI costs exceed `MAX_AI_COST_PER_TEST`
- **Budget alerts:** Warns at `AI_BUDGET_ALERT` threshold
- **Usage tracking:** Logs all AI calls in test reports

### Recommended Limits

- **Development/Testing:** `MAX_AI_COST_PER_TEST=0.50` ($0.50 per form)
- **CI/CD (automated):** `MAX_AI_COST_PER_TEST=0.30` (more conservative)
- **Production/Enterprise:** `MAX_AI_COST_PER_TEST=1.00` (full features)

## Model Selection Strategy

Different models for different tasks = optimal cost/performance:

| Task | Model | Cost/1M tokens |
|------|-------|----------------|
| Quick decisions | GPT-4o mini | $0.15 input, $0.60 output |
| Edge case handling | GPT-4 Turbo | $10 input, $30 output |
| Visual analysis | Gemini 2.0 Flash | Free tier, then $0.075 |
| Accessibility audits | Claude Sonnet 4 | $3 input, $15 output |

**Estimated costs:**
- Simple form (5 fields): $0.02 - $0.05
- Complex form (20 fields): $0.10 - $0.20
- Full audit (visual + a11y): $0.20 - $0.50
