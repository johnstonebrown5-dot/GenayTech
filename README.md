# EDU-TRACK School Management System (CBC-ready)

## Vendor (Company) Contact

- **Company:** EDUTRACK
- **Email:** edutrack46@gmail.com
- **Phone:** 0796031071

Monorepo structure:
- backend/ (Django 5, DRF, JWT, PostgreSQL, S3 storage, M-Pesa placeholders)
- frontend/ (React 18, Vite, TailwindCSS, Axios, role-based dashboards)
- docker-compose.yml (PostgreSQL, backend, frontend)

See README.md in each subfolder for setup. Start with docker-compose up after filling .env.

## Fees Statement Templates
- **Email template**: `templates/statement_email.html`
- **Print/PDF template**: `templates/statement_print.html`
- **Sample data**: `sample_data.json` (use as context for rendering)

### Quick preview
- **Static preview**: Open each HTML file directly in a browser. You will see placeholders like `{{student_name}}`.
- **With sample data**: Render with any templating engine that supports `{{ }}` (e.g., Django Templates, Handlebars, Nunjucks). Use `sample_data.json` to populate fields.

### Django integration (backend/)
1. Place the two HTML files under your Django templates directory (or add `EDU-TRACK/templates/` to `TEMPLATES['DIRS']`).
2. In a view, build a context dict and render:

```python
from django.shortcuts import render

def fees_statement(request):
    context = {
        # populate from your models
        "school_name": "Greenfield Academy",
        # ... (see sample_data.json for keys)
    }
    return render(request, "statement_print.html", context)
```
### Emailing the statement
- For highest compatibility, use `templates/statement_email.html` and inline it as the HTML body in your mailer.
- Replace placeholders via your template engine before sending.

### Generating a PDF
- Recommended: use `statement_print.html` and a HTML→PDF tool such as WeasyPrint or wkhtmltopdf.
- Example command (wkhtmltopdf):
  `wkhtmltopdf path/to/rendered_statement_print.html fees-statement.pdf`

### Customization tips
- Update colors, logo block, and fields directly in the HTML/CSS.
- Add a QR code for payments by replacing the `QR/Pay Ref` box with an actual image.
- Keep currency consistent by passing a `currency` value in context (e.g., `KES`).
