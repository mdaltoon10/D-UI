import os
import glob

html_picture = """<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/mdaltoon10/D-UI/main/media/d-ui-dark.png">
    <source media="(prefers-color-scheme: light)" srcset="https://raw.githubusercontent.com/mdaltoon10/D-UI/main/media/d-ui-light.png">
    <img alt="D-UI Preview" src="https://raw.githubusercontent.com/mdaltoon10/D-UI/main/media/d-ui-dark.png" width="100%">
  </picture>
</p>"""

old_picture = """<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="./media/d-ui-dark.png">
    <source media="(prefers-color-scheme: light)" srcset="./media/d-ui-light.png">
    <img alt="D-UI Preview" src="./media/d-ui-dark.png" width="100%">
  </picture>
</p>"""

for f in glob.glob("README*.md"):
    with open(f, "r", encoding="utf-8") as file:
        content = file.read()
        content = content.replace(old_picture, html_picture)
    with open(f, "w", encoding="utf-8") as file:
        file.write(content)

