# Faculty Market Atlas: put it on GitHub and install it on your computer

This package turns your job-market spreadsheet into a small app. It is hosted for free on GitHub Pages and you can install it on Windows or Mac like any other program. Every time you open it, it checks whether your data is a day old and, if so, reads the Google Sheet again.

You do not need to write any code. Part 1 takes about ten minutes and you do it once.

## What is in this folder

| Name | What it is |
| --- | --- |
| `docs/` | The app itself. This is the folder GitHub publishes. |
| `src/` and `build.py` | The source files and the script that builds `docs/`. You can ignore these. |
| `README.md` | This guide. |

## About privacy

- **This package contains no data from your sheet and no link to it.** The sheet is an anonymous community document, so it is not copied anywhere.
- A GitHub Pages site is public. That is fine here, because the public page is only the empty app.
- You paste your sheet link once, in your own browser. It is saved in that browser only. From then on your browser reads the sheet directly from Google. No other server is involved.

## Part 1: Put the app on GitHub (once)

1. Go to **github.com** and sign in. If you have no account, create a free one.
2. Click the **+** at the top right, then **New repository**.
3. Name it `faculty-market-atlas`. Choose **Public**. Leave "Add a README file" **unticked**. Click **Create repository**.
   - Free accounts can only publish a Pages site from a public repository.
4. On the next page, click the link **uploading an existing file**.
5. Unzip this package on your computer. Open the unzipped folder, select **everything inside it** (`docs`, `src`, `build.py`, `README.md`) and drag it onto the GitHub page.
   - Drag the contents, not the zip file itself.
   - Wait until every file has finished uploading. You should see the `docs` and `src` folders in the list.
6. Type a short message such as `Add app` and click **Commit changes**.
7. Turn on the website. Click **Settings** (top menu of your repository), then **Pages** (left sidebar). Under **Build and deployment**:
   - **Source:** Deploy from a branch
   - **Branch:** `main`, and the folder **`/docs`**
   - Click **Save**.
8. Wait one to two minutes and reload that page. A box appears saying **Your site is live at** `https://YOUR-USERNAME.github.io/faculty-market-atlas/`. Open that address.

GitHub changes its screens from time to time, so a button may be labelled a little differently. The settings you want are "Deploy from a branch", `main`, `/docs`.

## Part 2: Connect your sheet (once per browser)

1. On the first screen, paste the address of your Google Sheet and click **Connect**.
   - Open the sheet in your browser and copy the whole address from the address bar.
   - The sheet must be shared as **Anyone with the link can view**.
2. After a few seconds your data appears. The app keeps a copy, so the next visit opens instantly.

## Part 3: Install it on your computer

Open your `github.io` address in the browser you prefer.

**Windows or Mac, Chrome or Edge**
- Click the **Install app** button at the top of the page, or the install icon at the right end of the address bar (a small screen with a down arrow).
- Or open the browser menu (three dots) and choose **Install Faculty Market Atlas** (Chrome: under "Cast, save and share"; Edge: under "Apps").
- Confirm. The app opens in its own window with its own icon.

**Mac, Safari** (macOS Sonoma 14 or later)
- Choose **File**, then **Add to Dock**.
- The Safari version keeps its own saved data, so paste your sheet link once more in that window.

**Keep it handy**
- Windows: right-click the app icon on the taskbar and choose **Pin to taskbar**.
- Mac: right-click the icon in the Dock, then **Options**, then **Keep in Dock**.

If the installed app asks for the sheet link again, paste it again. Nothing is lost.

## How the daily update works

- When you open the app, or come back to it after a break, it checks how old your copy is. If it is older than a day, it reads the sheet again.
- **Settings** (the sliders icon) lets you choose 6, 12, 24 or 48 hours. The **Refresh** button updates immediately.
- With no internet, the app shows the last copy it saved.
- **Settings** also holds your keywords. Postings that match them are highlighted and get their own filter.

## Updating the app itself later

If you get a newer version of this package:

1. Unzip it.
2. On GitHub, open your repository, then the `docs` folder. Click **Add file**, then **Upload files**, and drop in the new files from the new `docs` folder. Do the same for `src` if it changed.
3. Click **Commit changes**. After a minute, close and reopen the app.

Your sheet link and saved copy stay in your browser and are not affected.

## If something goes wrong

| What you see | What to do |
| --- | --- |
| A "404" page at your address | Wait a few minutes. Then check Settings, Pages: it must say `main` and `/docs`, and `docs/index.html` must exist in the repository. |
| "Google Sheets could not be reached" | You are offline, or your network blocks `docs.google.com`. Click **Try again**. As a fallback, in Google Sheets use File, Download, Microsoft Excel, then choose that file in the app (Settings, or drag it onto the page). |
| An error mentioning status 403 or 404 | The link is wrong, or the sheet is not shared with "Anyone with the link". |
| No install button or icon | Open the `https://` address in Chrome or Edge. A file opened from your computer cannot be installed. On a managed work computer, an IT policy may block installs. You can still bookmark the page, and it works the same in a tab. |
| You want to remove the app | Open it, choose the three-dot menu, then **Uninstall**. In the app, **Settings**, **Clear saved data** forgets your sheet link first. |

## For later (optional)

`python3 build.py hosted` rebuilds `docs/index.html` and `docs/sw.js` from the files in `src/`. You only need this if you change the source. It needs Python 3 and nothing else.
