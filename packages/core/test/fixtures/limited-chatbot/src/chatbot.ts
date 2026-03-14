import OpenAI from 'openai'

const client = new OpenAI()

export async function chat(message: string) {
  const response = await client.chat.completions.create({
    model: 'gpt-4',
    messages: [{ role: 'user', content: message }],
  })
  return response.choices[0]?.message.content
}
