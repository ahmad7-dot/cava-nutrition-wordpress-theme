# Setting Up Cava Nutrition Theme on GitHub

## Step 1: Create GitHub Repository

1. Go to **github.com** and sign in (or create account if needed)
2. Click **+** icon (top right) → **New repository**
3. Fill in:
   - **Repository name:** `cava-nutrition-wordpress-theme`
   - **Description:** `Complete WordPress theme for Cava nutrition calculator`
   - **Public** (so you can download as ZIP)
   - Click **Create repository**

## Step 2: Upload Files via GitHub Web Interface

GitHub allows direct file uploads. For each file:

1. In your new repository, click **Add file** → **Create new file**
2. Name: `style.css`
3. Paste the style.css content
4. Click **Commit changes**

Repeat for:
- functions.php
- header.php
- footer.php
- index.php
- front-page.php
- page-menu.php
- page-about.php
- page-database.php
- page-faq.php
- page-contact.php

### For Folders/Subfiles:

Click **Add file** → **Create new file** and name it:
- `assets/js/calculator.js`
- `assets/js/faq.js`
- `assets/css/main.css`

GitHub auto-creates folders!

## Step 3: Download as ZIP

1. In your repository, click **Code** (green button)
2. Select **Download ZIP**
3. Save to your computer

## Step 4: Upload to WordPress

1. Unzip the file
2. FTP/File Manager to `/wp-content/themes/`
3. Upload `cava-nutrition-wordpress-theme` folder
4. Activate in WordPress Admin

## Alternative: Use GitHub Desktop (Easier)

If uploading files manually is tedious:

1. Download **GitHub Desktop** (desktop.github.com)
2. Sign in with your GitHub account
3. Click **File** → **New Repository**
4. Name: `cava-nutrition-wordpress-theme`
5. Local path: Choose a folder on your computer
6. Create repository

Then:
1. Copy all theme files into that folder
2. In GitHub Desktop, you'll see files as "Changes"
3. Click **Commit to main**
4. Click **Publish repository**
5. Your files are now on GitHub!

Then download as ZIP as described above.

## File Structure on GitHub

```
cava-nutrition-wordpress-theme/
├── style.css
├── functions.php
├── header.php
├── footer.php
├── index.php
├── front-page.php
├── page-menu.php
├── page-about.php
├── page-database.php
├── page-faq.php
├── page-contact.php
├── README.md (optional)
└── assets/
    ├── js/
    │   ├── calculator.js
    │   └── faq.js
    └── css/
        └── main.css
```

## Quick Commands (If Using Git)

If you're comfortable with command line:

```bash
# Clone repo locally
git clone https://github.com/yourusername/cava-nutrition-wordpress-theme.git
cd cava-nutrition-wordpress-theme

# Add all files
git add .

# Commit
git commit -m "Initial theme files"

# Push to GitHub
git push origin main
```

Then download as ZIP from GitHub web interface.

## Share & Use

Once uploaded:
- **Download Link:** github.com/yourusername/cava-nutrition-wordpress-theme → Code → Download ZIP
- **Share with others:** Simply share the repository URL
- **Updates:** Push changes directly from GitHub Desktop

## Benefits of GitHub

✓ Version control (see all changes)
✓ Easy to download as ZIP
✓ Share with team members
✓ Free hosting for theme code
✓ Can add collaborators
✓ Easy to update later

## Next Steps

1. Create GitHub account (if needed)
2. Create new repository
3. Upload all theme files
4. Download as ZIP
5. Extract to `/wp-content/themes/`
6. Activate in WordPress
7. Add pages & nutrition data
8. Done!

Need help with any step?
