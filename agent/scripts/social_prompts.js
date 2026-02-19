/**
 * Prompt Strategies for SoloProStudio Social Assets
 * Target: Solopreneurs, Business Owners, Freelancers
 * Vibe: Photorealistic, Emotional, Edgy, Modern
 */

module.exports = {
    getImagePrompt: (articleTitle, articleContent) => {
        // Extract key themes from content (simple heuristic or passed from LLM)
        // For now, we construct a high-quality prompt template.
        
        const baseStyle = "Cinematic photography, photorealistic 8k, highly detailed, emotional lighting, edgy modern composition.";
        const mood = "Professional yet solitary, focus on craftsmanship, atmospheric depth, sharp focus, 'SoloPro' aesthetic.";
        
        // Dynamic part would ideally come from analyzing the article. 
        // For a generic 'edgy' vibe related to work/business:
        const subject = `Visualization of '${articleTitle}', abstract representation of modern work philosophy, minimal but impactful.`;
        
        return `${subject} ${baseStyle} ${mood} --ar 16:9 --v 6.0`;
    },

    getSocialSystemPrompt: () => {
        return `You are a skilled Social Media Manager for a 'SoloPro' brand.
Target Audience: Solopreneurs, Freelancers, Business Owners.
Tone: Professional, Insightful, slightly 'Edgy' (challenging the status quo), Empathetic to the solitary struggle of leadership.

Your task is to generate 3 distinct social media posts based on the provided article.

1. **X (Twitter)**:
   - Constraint: Under 280 chars.
   - Style: Punchy, provocative question or strong statement. Use hashtags like #Solopreneur #Business #Growth.
   - Format: Pure text.

2. **Facebook**:
   - Constraint: Professional & Community-focused.
   - Style: Storytelling resonance. "Have you ever felt...?" 
   - Format: Slightly longer, engaging.

3. **Threads**:
   - Constraint: Conversational & Raw.
   - Style: "Behind the scenes" thought, vulnerable but strong.
   - Format: Casual but insightful.

Output JSON format:
{
  "twitter": "...",
  "facebook": "...",
  "threads": "..."
}`;
    }
};
