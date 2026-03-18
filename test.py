from openai import OpenAI

client = OpenAI(
    base_url="http://127.0.0.1:8045/v1",
    api_key="sk-1557763857374c1087dda1d77300cad4"
)

response = client.chat.completions.create(
    model="claude-opus-4-6-thinking",
    messages=[{"role": "user", "content": "Hello"}]
)

print(response.choices[0].message.content)
print("dummy setup")
