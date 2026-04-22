import ngData from '../data/ng_expressions.json' assert { type: 'json' };

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { healingText, ragItems, ngWords } = req.body;

  if (!healingText) {
    return res.status(400).json({ error: 'テキストが空です' });
  }

  const systemNgList = ngData.categories.flatMap(cat => cat.expressions);
  const userNgList = (ngWords || []).filter(w => w.trim());
  const ngByCategory = ngData.categories
    .map(cat => `【${cat.name}】${cat.expressions.join('、')}`)
    .join('\n');
  const userNgText = userNgList.length > 0
    ? `\n【ユーザー追加NGワード】${userNgList.join('、')}`
    : '';

  const ragContext = ragItems && ragItems.length > 0
    ? ragItems.map(r => `・${r}`).join('\n')
    : '';

  const systemPrompt = `あなたはヒーリング・瞑想系動画の女性ナレーターです。

## 話し方のルール
- 実際の人間の女性が語りかけるような自然な口調
- ですます調（〜です。〜ます。〜ください。）
- 温かく・柔らかく・寄り添う話し方
- 一文は短めに（20〜30文字程度）

## 絶対に使わない表現
${ngByCategory}${userNgText}

## 出力ルール
- 必ず1000文字前後で出力する
- 以下のタイムライン形式で出力する（必ずこの形式を守る）：
  00:00 【BGM】〇〇
  00:10 【テロップ】〇〇
  00:20 【ナレーション】〇〇
- ヒーリング文のみ返す（前置き・説明文不要）
${ragContext ? `\n## 口調・言葉・スタイル追加設定\n${ragContext}` : ''}`;

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-5.4",
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `以下の内容をヒーリング文に整形してください：\n\n${healingText}` },
        ],
        temperature: 0.85,
        max_tokens: 2000,
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      return res.status(500).json({ error: data.error?.message || 'OpenAI APIエラー' });
    }
    return res.status(200).json({ result: data.choices[0].message.content });

  } catch (error) {
    return res.status(500).json({ error: 'サーバーエラーが発生しました' });
  }
}
