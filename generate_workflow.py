import json
import uuid
import datetime

def generate():
    workflow = {
      "id": "sincerity-check-" + str(uuid.uuid4())[:8],
      "name": "Sincerity Check",
      "active": False,
      "createdAt": datetime.datetime.utcnow().isoformat() + "Z",
      "updatedAt": datetime.datetime.utcnow().isoformat() + "Z",
      "nodes": [
        {
          "parameters": {
            "httpMethod": "POST",
            "path": "sincerity-check",
            "responseMode": "responseNode",
            "options": {}
          },
          "id": str(uuid.uuid4()),
          "name": "Webhook",
          "type": "n8n-nodes-base.webhook",
          "typeVersion": 2.1,
          "position": [200, 300]
        },
        {
          "parameters": {
            "mode": "runOnceForEachItem",
            "jsCode": """
const body = $input.item.json.body || {};
const text = body.apology_text || '';
const minWords = body.min_words || 50;
const threshold = body.threshold || 70;
const letter = body.letter || 'Unknown';

const wordCount = text.split(/\\s+/).filter(w => w.length > 0).length;

const prompt = `You are the Sincerity Warden, a whimsical but fair judge in a typing-test game.
A player just deleted the letter "${letter}" by pressing Backspace, and must now
atone by writing a genuine, thoughtful apology of at least ${minWords} words
addressed directly to that letter.

Evaluate the apology below strictly on:
1. Genuine tone and effort.
2. Coherence and relevance to apologizing to the letter "${letter}".
3. Absence of filler, copy-pasted repetition, or nonsense text used purely to
   hit the word count.

Respond with ONLY a JSON object matching the required schema, no other text.
A sincerity_score of ${threshold} or above must map to verdict "pass"; below it,
"fail". Be encouraging but do not pass apologies that are clearly insincere,
nonsensical, or padded filler.

Apology to evaluate:
\"\"\"
${text}
\"\"\"`;

$input.item.json.wordCount = wordCount;
$input.item.json.minWords = minWords;
$input.item.json.prompt = prompt;
return $input.item;
            """
          },
          "id": str(uuid.uuid4()),
          "name": "Prepare & Validate",
          "type": "n8n-nodes-base.code",
          "typeVersion": 2,
          "position": [400, 300]
        },
        {
          "parameters": {
            "conditions": {
              "options": {
                "caseSensitive": True,
                "leftValue": "",
                "typeValidation": "strict"
              },
              "conditions": [
                {
                  "id": "e93f6682-1df8-4c90-b997-512c9c5427d7",
                  "leftValue": "={{ $json.wordCount }}",
                  "rightValue": "={{ $json.minWords }}",
                  "operator": {
                    "type": "number",
                    "operation": "gte"
                  }
                }
              ],
              "combinator": "and"
            },
            "options": {}
          },
          "id": str(uuid.uuid4()),
          "name": "Check Word Count",
          "type": "n8n-nodes-base.if",
          "typeVersion": 3,
          "position": [600, 300]
        },
        {
          "parameters": {
            "respondWith": "json",
            "responseBody": "={\n  \"sincerity_score\": 0,\n  \"verdict\": \"fail\",\n  \"feedback\": \"Your apology was too short. You need at least {{ $json.minWords }} words.\"\n}",
            "options": {}
          },
          "id": str(uuid.uuid4()),
          "name": "Respond Fail (Too Short)",
          "type": "n8n-nodes-base.respondToWebhook",
          "typeVersion": 1.1,
          "position": [800, 500]
        },
        {
          "parameters": {
            "method": "POST",
            "url": "http://host.docker.internal:11434/api/chat",
            "sendBody": True,
            "specifyBody": "json",
            "jsonBody": "={\n  \"model\": \"llama3.1:8b\",\n  \"messages\": [\n    {\n      \"role\": \"user\",\n      \"content\": {{ JSON.stringify($json.prompt) }}\n    }\n  ],\n  \"stream\": false,\n  \"options\": {\n    \"temperature\": 0.2\n  },\n  \"format\": {\n    \"type\": \"object\",\n    \"properties\": {\n      \"sincerity_score\": { \"type\": \"integer\", \"minimum\": 0, \"maximum\": 100 },\n      \"verdict\": { \"type\": \"string\", \"enum\": [\"pass\", \"fail\"] },\n      \"feedback\": { \"type\": \"string\" }\n    },\n    \"required\": [\"sincerity_score\", \"verdict\", \"feedback\"]\n  }\n}",
            "options": {}
          },
          "id": str(uuid.uuid4()),
          "name": "Ollama HTTP Request",
          "type": "n8n-nodes-base.httpRequest",
          "typeVersion": 4.2,
          "position": [800, 100]
        },
        {
          "parameters": {
            "mode": "runOnceForEachItem",
            "jsCode": """
try {
  const content = JSON.parse($input.item.json.message.content);
  return {
    json: {
      sincerity_score: content.sincerity_score || 0,
      verdict: content.verdict === 'pass' ? 'pass' : 'fail',
      feedback: content.feedback || 'No feedback provided.'
    }
  };
} catch (e) {
  return {
    json: {
      sincerity_score: 0,
      verdict: 'fail',
      feedback: 'The Sincerity Warden was confused by your apology (internal error).'
    }
  };
}
            """
          },
          "id": str(uuid.uuid4()),
          "name": "Parse & Guard",
          "type": "n8n-nodes-base.code",
          "typeVersion": 2,
          "position": [1000, 100]
        },
        {
          "parameters": {
            "respondWith": "json",
            "responseBody": "={{ JSON.stringify($json) }}",
            "options": {}
          },
          "id": str(uuid.uuid4()),
          "name": "Respond Success",
          "type": "n8n-nodes-base.respondToWebhook",
          "typeVersion": 1.1,
          "position": [1200, 100]
        }
      ],
      "connections": {
        "Webhook": {
          "main": [
            [
              {
                "node": "Prepare & Validate",
                "type": "main",
                "index": 0
              }
            ]
          ]
        },
        "Prepare & Validate": {
          "main": [
            [
              {
                "node": "Check Word Count",
                "type": "main",
                "index": 0
              }
            ]
          ]
        },
        "Check Word Count": {
          "main": [
            [
              {
                "node": "Ollama HTTP Request",
                "type": "main",
                "index": 0
              }
            ],
            [
              {
                "node": "Respond Fail (Too Short)",
                "type": "main",
                "index": 0
              }
            ]
          ]
        },
        "Ollama HTTP Request": {
          "main": [
            [
              {
                "node": "Parse & Guard",
                "type": "main",
                "index": 0
              }
            ]
          ]
        },
        "Parse & Guard": {
          "main": [
            [
              {
                "node": "Respond Success",
                "type": "main",
                "index": 0
              }
            ]
          ]
        }
      },
      "settings": {
        "executionOrder": "v1"
      }
    }
    
    # Wrap in an array!
    with open('/home/fahim/projects/useless/n8n/workflows/sincerity-check.json', 'w') as f:
        json.dump([workflow], f, indent=2)

if __name__ == '__main__':
    generate()
