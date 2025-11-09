# MAS Debate System - Quick Start Guide

## Setup (5 minutes)

### 1. Environment Variables

Make sure you have OpenAI API key set:

```bash
# In backend/.env or root .env
OPENAI_API_KEY=sk-...your-key-here
```

### 2. Install Dependencies (if needed)

```bash
cd backend
npm install
# or
pnpm install
```

### 3. Start the Server

```bash
cd backend
npm run dev
```

Server should start on `http://localhost:4000`

## Quick Test (2 minutes)

### Option A: Using the Test Script

```bash
cd backend
tsx src/scripts/testMasDebate.ts
```

This will:
- Generate questions from a sample paper
- Run a complete debate with 3 postures
- Show results in terminal
- Save reports to `test-debate-report.json` and `test-debate-report.md`

### Option B: Using the API

First, upload a paper via the existing paper upload endpoint, then:

```bash
# 1. Generate questions
curl -X POST http://localhost:4000/api/mas-debate/questions \
  -H "Content-Type: application/json" \
  -d '{"paperId": "your-paper-id"}'

# 2. Run complete debate (this will take a few minutes)
curl -X POST http://localhost:4000/api/mas-debate/run \
  -H "Content-Type: application/json" \
  -d '{
    "paperId": "your-paper-id",
    "question": "What are the key limitations of the proposed method?",
    "numPostures": 3
  }'
```

### Option C: With Progress Updates (SSE)

```bash
curl -X POST http://localhost:4000/api/mas-debate/run \
  -H "Content-Type: application/json" \
  -H "Accept: text/event-stream" \
  -d '{
    "paperId": "your-paper-id",
    "question": "What are the key limitations of the proposed method?",
    "numPostures": 3
  }'
```

You'll see real-time progress events as the debate proceeds.

## API Endpoints

All endpoints are under `/api/mas-debate`:

| Endpoint | Method | Purpose | Time |
|----------|--------|---------|------|
| `/questions` | POST | Generate questions | ~30s |
| `/postures` | POST | Generate postures & topics | ~20s |
| `/run` | POST | Run complete debate | ~2-5min |
| `/run-complete` | POST | Full flow with questions | ~3-6min |

## Expected Flow

1. **Upload Paper** → Use existing `/api/papers/upload`
2. **Generate Questions** → `POST /api/mas-debate/questions`
3. **User Selects Question** → Frontend UI
4. **Run Debate** → `POST /api/mas-debate/run` with SSE
5. **Display Report** → Show markdown or JSON results

## Typical Response Times

- Question Generation: 20-40 seconds
- Posture Generation: 15-30 seconds
- Debate (3 postures): 2-4 minutes (parallel execution)
- Judging: 30-60 seconds
- Report Generation: 20-40 seconds

**Total for complete flow: 3-6 minutes**

## Troubleshooting

### "OPENAI_API_KEY not found"
- Check your `.env` file in the backend directory
- Make sure it's named exactly `OPENAI_API_KEY`
- Restart the server after adding the key

### "Paper not found"
- Make sure you've uploaded a paper first
- Check the paper ID is correct
- Verify paper exists in database: `npx prisma studio`

### Debate takes too long
- This is normal! A 3-posture debate makes ~10-15 OpenAI API calls
- Use SSE to show progress to users
- Consider reducing `numPostures` to 2 for faster results

### JSON parsing errors
- The system has fallback JSON extraction
- If you see this repeatedly, check OpenAI API status
- Try with a smaller paper (< 10,000 words)

## Cost Estimation

Using GPT-4o (as of Nov 2024):
- Input: $2.50 per 1M tokens
- Output: $10.00 per 1M tokens

**Typical debate (3 postures, 5 topics, 10k word paper):**
- Input tokens: ~50,000 (paper + prompts)
- Output tokens: ~15,000 (arguments + reports)
- **Cost: ~$0.25 per debate**

## Next Steps

1. **Integrate with Frontend**
   - Add debate button to paper upload UI
   - Show progress bar during debate
   - Display report with visualizations

2. **Enhance Tools**
   - Replace mock webSearch with Tavily API
   - Add vector search for lookupPaper
   - Cache question generation

3. **Add Features**
   - Save debates to database
   - Allow custom rubrics
   - Export reports as PDF

## Example Output

After running a debate, you'll get a comprehensive report including:

- **Executive Summary** - 2-3 paragraph overview
- **Ranked Postures** - Scored from best to worst
- **Validated Insights** - Novel, actionable findings
- **Controversial Points** - Areas of disagreement
- **Recommended Reads** - 5-7 related resources
- **Appendix** - Detailed claims and scoring table
- **Markdown Version** - Human-readable report

## Support

- Full documentation: `MAS_DEBATE_SYSTEM.md`
- Implementation details: `MAS_IMPLEMENTATION_SUMMARY.md`
- API reference: See documentation above

## Tips for Best Results

1. **Paper Quality**: Works best with well-structured academic papers
2. **Question Selection**: Choose questions that have multiple valid perspectives
3. **Number of Postures**: 3 is optimal (2 is faster, 4+ takes longer)
4. **Paper Length**: 5k-20k words is ideal (too short = shallow debate, too long = expensive)

## Ready to Go! 🚀

You now have a fully functional Multi-Agent Debate System. Start with the test script to see it in action, then integrate it into your application.

