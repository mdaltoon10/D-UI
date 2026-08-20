import glob

html_old = """<p align="center">
  <img src="./media/d-ui-dark.png" alt="Daltoon-UI Preview" width="100%">
</p>"""

html_new = """<p align="center">
<picture>
  <source media="(prefers-color-scheme: dark)" srcset="./media/d-ui-dark.png">
  <source media="(prefers-color-scheme: light)" srcset="./media/d-ui-light.png">
  <img src="./media/d-ui-dark.png" alt="D-UI Preview" width="100%">
</picture>
</p>"""

for filepath in glob.glob("README*.md"):
    with open(filepath, "r", encoding="utf-8") as f:
        content = f.read()
    
    if html_old in content:
        content = content.replace(html_old, html_new)
        with open(filepath, "w", encoding="utf-8") as f:
            f.write(content)
        print(f"Updated {filepath}")
    else:
        print(f"Pattern not found in {filepath}")

