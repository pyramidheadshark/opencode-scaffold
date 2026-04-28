# HTMX Frontend

## When to Load This Skill

Load when working with: Jinja2 templates, HTMX attributes, static files, server-side rendering, admin panels, dashboards integrated into FastAPI.

## Architecture Decision

HTMX frontend lives inside the FastAPI application — no separate frontend service, no build step, no npm. This is intentional and correct for our use cases (internal tools, admin panels, dashboards with moderate load).

For high-traffic public frontends, consider a separate service. For everything else, co-location in FastAPI is simpler, easier to deploy, and has zero JS toolchain overhead.

## Router Separation

JSON API routes and HTMX page routes live in separate routers and must never mix:

```
api/
├── routers/
│   ├── items.py       # JSON API — returns Pydantic models
│   └── health.py
└── pages/
    ├── dashboard.py   # HTMX pages — returns TemplateResponse
    ├── admin.py
    └── chat.py
```

```python
from fastapi import APIRouter, Depends, Request
from fastapi.responses import HTMLResponse
from fastapi.templating import Jinja2Templates

templates = Jinja2Templates(directory="src/project_name/templates")
router = APIRouter()


@router.get("/", response_class=HTMLResponse)
async def dashboard(request: Request) -> HTMLResponse:
    return templates.TemplateResponse(
        "dashboard.html",
        {"request": request, "title": "Dashboard"},
    )


@router.get("/items/list", response_class=HTMLResponse)
async def items_list(request: Request, service=Depends(get_item_service)) -> HTMLResponse:
    items = await service.list_all()
    return templates.TemplateResponse(
        "partials/items_list.html",
        {"request": request, "items": items},
    )
```

## Template Structure

```
src/{project_name}/
├── templates/
│   ├── base.html           # base layout
│   ├── dashboard.html
│   ├── admin.html
│   └── partials/           # HTMX partial responses
│       ├── items_list.html
│       ├── chat_message.html
│       └── toast.html
└── static/
    ├── htmx.min.js         # pinned version, served locally
    ├── css/
    │   └── styles.css
    └── js/
        └── app.js          # minimal custom JS only
```

Pin HTMX version locally — do not use CDN in production.
Current stable: `htmx.org@2.0.x`.

## Base Template Pattern

```html
<!DOCTYPE html>
<html lang="ru">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{% block title %}{{ title }}{% endblock %}</title>
    <link rel="stylesheet" href="/static/css/styles.css">
    <script src="/static/htmx.min.js"></script>
</head>
<body hx-boost="true">
    <main id="content">
        {% block content %}{% endblock %}
    </main>

    <div id="toast-container" aria-live="polite"></div>
</body>
</html>
```

## Core HTMX Patterns

### Simple list refresh

```html
<div id="items-list" hx-get="/pages/items/list" hx-trigger="load">
    Loading...
</div>

<button
    hx-post="/api/v1/items"
    hx-target="#items-list"
    hx-swap="outerHTML"
    hx-include="[name='item-form']">
    Add Item
</button>
```

### Chat / streaming pattern

```html
<div id="chat-messages"></div>

<form
    hx-post="/pages/chat/send"
    hx-target="#chat-messages"
    hx-swap="beforeend"
    hx-on::after-request="this.reset()">
    <input type="text" name="message" placeholder="Ask a question..." autofocus>
    <button type="submit">Send</button>
</form>
```

Partial response for `partials/chat_message.html`:
```html
<div class="message message--{{ role }}">
    <p>{{ content }}</p>
    <time>{{ timestamp }}</time>
</div>
```

### Loading indicator

```html
<button
    hx-post="/api/v1/process"
    hx-indicator="#spinner">
    Process
    <span id="spinner" class="htmx-indicator">⏳</span>
</button>
```

### Toast notifications

```python
from fastapi.responses import HTMLResponse


def toast_response(message: str, variant: str = "success") -> HTMLResponse:
    html = f'<div class="toast toast--{variant}" hx-swap-oob="beforeend:#toast-container">{message}</div>'
    return HTMLResponse(content=html)
```

## Static Files Setup

```python
from fastapi.staticfiles import StaticFiles

app.mount("/static", StaticFiles(directory="src/project_name/static"), name="static")
```

## Performance Considerations

HTMX + FastAPI handles ~500 concurrent users comfortably on a single 2-core VM.
For higher load:
- Add `nginx` as reverse proxy in `docker-compose.yml` with static file caching
- Enable Jinja2 template caching (`auto_reload=False` in production)
- Use `hx-boost="true"` on `<body>` for SPA-like navigation without full reloads

If concurrent users exceed ~2000, evaluate separating the frontend service.

## .env Keys Required

None specific to HTMX — uses the same FastAPI app configuration.
