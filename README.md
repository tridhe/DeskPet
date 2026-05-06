# DeskPet 🐕

A macOS desktop app that fights procrastination with a Shiba Inu who won't leave you alone until you get back to work.

## What it does

DeskPet runs quietly in the background and watches what you're doing. The moment it catches you on a distracting website — YouTube, Reddit, Twitter, Netflix, and more — a Shiba Inu appears in the corner of your screen. Ignore it and it gets angry. Pet it (by dragging your mouse across it) to dismiss it and get back to work.

The dog also celebrates with you when you complete a task, giving you a moment of positive reinforcement alongside the guilt.

## Features

- **Distraction detection** — monitors your active window every 5 seconds using your system's accessibility APIs
- **Configurable no-go list** — add or remove any sites or apps you want to block
- **Configurable timers** — set how long before the dog appears and how long before it goes angry
- **6 Shiba Inu animations** — flirting, angry, tail wag, sparkly eyes, smiling, and unicorn celebration
- **Petting mechanic** — drag horizontally across the dog to dismiss it; the more you procrastinate, the guiltier the message
- **Task list** — add your goals for the day and check them off
- **End of day summary** — see how many times you got caught and how much time you wasted

## Technical architecture

| Layer | Technology |
|---|---|
| Framework | Electron (Node.js + Chromium) |
| UI | Vanilla HTML/CSS/JS |
| Animations | Lottie Web (`lottie-web`) |
| Distraction detection | `active-win` — reads the system's active window title and URL |
| Storage | `localStorage` — tasks, settings, and the no-go list |
| Audio | HTML5 Audio API |

The app runs two Electron `BrowserWindow` instances:

1. **Main window** (`app.html`) — task list UI, settings, no-go list configuration, and the distraction detection loop
2. **Overlay window** (`overlay.html`) — transparent, frameless, always-on-top window (`screen-saver` level) that hosts the Shiba Inu animations and petting mechanic

The main window polls `active-win` every 5 seconds. When a distraction is detected continuously for longer than the configured grace period, it sends an IPC message to the main process, which forwards it to the overlay window to trigger the dog.

## Installation

**Prerequisites:** Node.js v18 or later, macOS

```bash
git clone https://github.com/tridhe/DeskPet.git
cd DeskPet
npm install
npm start
```

On first launch, macOS will ask for **Screen Recording permission** — this is required for `active-win` to read window titles and URLs. Grant it to `Electron` in:

> System Settings → Privacy & Security → Screen Recording

After granting permission, restart the app.
