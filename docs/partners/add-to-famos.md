# Add to FamOS buttons

After this app and `public/partner/add-to-famos.js` are deployed, a website can embed the control using the script below. The visitor signs in, reviews the proposed event or recipe and chooses whether to save. No data is saved just by clicking the button.

```html
<script async src="https://fam-os.app/partner/add-to-famos.js"
  data-event-title="Family movie night"
  data-event-start="2027-04-10T19:00:00-04:00"
  data-event-end="2027-04-10T21:00:00-04:00"
  data-event-location="Community centre"
  data-recipe-title="Tomato pasta"
  data-recipe-url="https://example.com/recipes/tomato-pasta"></script>
```

Include event title and start for an event option, and/or recipe URL for a recipe option. Timed events require an explicit UTC offset or `Z` and are displayed in the visitor's local time; all-day dates use `YYYY-MM-DD`, with an inclusive end date. When both are supplied, the visitor can select an option. Use non-sensitive event details only: link parameters can be visible in browser history and server logs. Recipe links are sent to the existing importer only when the visitor chooses to import. Partner attribution is not enabled by this control yet.
