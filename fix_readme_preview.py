import glob
import re

html_old_pattern = r'<p align="center">\s*<img src="https://raw\.githubusercontent\.com/mdaltoon10/D-UI/main/media/d-ui-light\.png#gh-light-mode-only"[^>]*>\s*<img src="https://raw\.githubusercontent\.com/mdaltoon10/D-UI/main/media/d-ui-dark\.png#gh-dark-mode-only"[^>]*>\s*</p>'

html_new = """<p align="center">
  <img src="./media/preview.png" alt="D-UI Preview" width="100%">
</p>"""

for filepath in glob.glob("README*.md"):
    with open(filepath, "r", encoding="utf-8") as f:
        content = f.read()
    
    new_content = re.sub(html_old_pattern, html_new, content, flags=re.MULTILINE)
    
    if new_content != content:
        with open(filepath, "w", encoding="utf-8") as f:
            f.write(new_content)
        print(f"Updated {filepath}")
    else:
        print(f"Pattern not found in {filepath}")
