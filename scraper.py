import sys
import requests
import re
import json
from datetime import datetime

results = []

def extract_updated_on_text(html):
    match = re.search(r'Updated on[:\s]*([A-Za-z]+\s\d{1,2},\s\d{4})', html)
    return match.group(1).strip() if match else None

def extract_date_modified_text(html):
    match = re.search(r'"dateModified"\s*:\s*"(\d{4}-\d{2}-\d{2})"', html)
    return match.group(1) if match else None

def dates_match(visible_date, schema_date):
    try:
        dt_visible = datetime.strptime(visible_date, "%b %d, %Y")
        dt_schema = datetime.strptime(schema_date, "%Y-%m-%d")
        return dt_visible == dt_schema
    except:
        return False

for url in sys.argv[1:]:
    try:
        res = requests.get(url, timeout=15)
        html = res.text

        updated_on = extract_updated_on_text(html)
        date_modified = extract_date_modified_text(html)
        matched = dates_match(updated_on, date_modified) if updated_on and date_modified else False

        results.append({
            'url': url,
            'updatedOn': updated_on or '❌ Not found',
            'dateModified': date_modified or '❌ Not found',
            'match': matched
        })

    except Exception:
        results.append({
            'url': url,
            'updatedOn': '❌ Error',
            'dateModified': '❌ Error',
            'match': False
        })

# Sort mismatches first
results.sort(key=lambda x: x['match'])

# Save results to JSON
with open('results.json', 'w', encoding='utf-8') as f:
    json.dump(results, f, indent=2)

# Print clean text for debugging (no emoji)
print("\nValidation Results:\n")
print(f"{'Status':<6} | {'Updated On':<15} | {'dateModified':<15} | URL")
print("-" * 100)
for r in results:
    status = "PASS" if r["match"] else "FAIL"
    print(f"{status:<6} | {r['updatedOn']:<15} | {r['dateModified']:<15} | {r['url']}")
