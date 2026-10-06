import json
import glob
import os

for filepath in glob.glob("internal/web/translation/*.json"):
    with open(filepath, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    if "pages" in data and "settings" in data["pages"] and "ipLimitPolicyOptions" in data["pages"]["settings"]:
        opts = data["pages"]["settings"]["ipLimitPolicyOptions"]
        
        # En-US default texts for fallback
        opts["kick_oldest"] = "Kick Oldest (Ban IP)"
        opts["kick_oldest_kick_only"] = "Kick Oldest (No Ban, Disconnect Only)"
        opts["block_newest"] = "Block Newest (Ban IP) [Default]"
        opts["block_newest_kick_only"] = "Block Newest (No Ban, Disconnect Only)"
        
        # Remove old kick_only if exists
        opts.pop("kick_only", None)
        
        if "fa-IR" in filepath:
            opts["kick_oldest"] = "قطع اتصال قدیمی‌ترین (با مسدودسازی IP)"
            opts["kick_oldest_kick_only"] = "فقط قطع اتصال قدیمی‌ترین (بدون مسدودسازی IP)"
            opts["block_newest"] = "قطع اتصال جدیدترین (با مسدودسازی IP) [پیش‌فرض]"
            opts["block_newest_kick_only"] = "فقط قطع اتصال جدیدترین (بدون مسدودسازی IP)"

    with open(filepath, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
        f.write('\n')

print("Translations updated successfully.")
