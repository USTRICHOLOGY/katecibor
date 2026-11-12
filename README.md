# Pure Hair Spa website

The website for Pure Hair Spa, a boutique hair and scalp spa at 3655 W Maple Rd, Bloomfield Township, MI 48301.

It is a static site (plain HTML, CSS and JavaScript, no server code), so it can be hosted on GitHub Pages, Netlify, Vercel or any web host.

## Pages

| File | Page |
| --- | --- |
| `index.html` | Home |
| `services.html` | Service menu and products |
| `faq.html` | FAQ |
| `contact.html` | Contact and booking |

Images and the waterfall video are in `assets/`. `js/dc-lite.js` renders the pages and runs the menu, sliders, accordions and page transition.

## Hosting on GitHub Pages

1. In this repo go to **Settings > Pages**.
2. Under **Build and deployment**, choose **Deploy from a branch**, branch `main`, folder `/ (root)`, and save.
3. The site goes live at the address GitHub shows a minute later. To use purehairspa.com, add it under **Custom domain** and point the domain's DNS at GitHub Pages.

To preview locally, run `python3 -m http.server` in this folder and open http://localhost:8000. Opening the HTML files directly from disk also works, but the waterfall ripple effect only runs when the site is served.

## Editing

The page designs live in `design/` (`Main.dc.html` is the home page). After editing them, rebuild the pages with:

```
python3 tools/build.py design
```

## Still to do before launch

- **Contact form:** it shows a thank-you message but does not send anywhere yet. Connect it to a form service (Formspree, Netlify Forms, or the salon's booking system) before launch.
- **Prices and times:** the service menu shows `[PRICE] · [TIME]` placeholders.
- **Placeholder photos:** the Our story and Hair reconstruction sections, the team cards and the product grid still have photo placeholders. The before and after images are AI samples and are labelled as such.
- **Hours:** the site says Tue to Sat, 9am to 5pm. Confirm against the salon's current hours.
- **Photo consent:** confirm consent for client photos taken from Instagram.
