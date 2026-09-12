import json
with open('/home/fahim/projects/useless/workflows.json', 'r') as f:
    data = json.load(f)
for wf in data:
    for node in wf.get('nodes', []):
        if 'if' in node.get('type', '').lower():
            print(json.dumps(node, indent=2))
            break
