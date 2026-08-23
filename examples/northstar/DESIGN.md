---
version: alpha
name: Northstar Operations Ledger
description: A visual system for controlled, evidence-rich operational work.
colors:
  primary: "#172033"
  secondary: "#526078"
  accent: "#1F6B5C"
  surface: "#F7F8FA"
  paper: "#FFFFFF"
  border: "#CBD2DC"
  on-primary: "#FFFFFF"
typography:
  heading:
    fontFamily: IBM Plex Sans
    fontSize: 2rem
    fontWeight: 600
    lineHeight: 1.2
  body:
    fontFamily: IBM Plex Sans
    fontSize: 1rem
    fontWeight: 400
    lineHeight: 1.55
  metadata:
    fontFamily: IBM Plex Mono
    fontSize: 0.75rem
    fontWeight: 500
    lineHeight: 1.4
rounded:
  sm: 3px
  md: 6px
spacing:
  xs: 4px
  sm: 8px
  md: 16px
  lg: 24px
  xl: 40px
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    rounded: "{rounded.sm}"
    padding: 12px
  evidence-panel:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.primary}"
    rounded: "{rounded.md}"
    padding: 16px
  status-confirmed:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.on-primary}"
    rounded: "{rounded.sm}"
    padding: 8px
  metadata-rule:
    backgroundColor: "{colors.border}"
    textColor: "{colors.primary}"
    rounded: "{rounded.sm}"
    padding: 8px
  supporting-copy:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.secondary}"
    rounded: "{rounded.sm}"
    padding: 8px
---

# Northstar Operations Ledger

## Overview

An operations ledger rather than an AI spectacle: quiet, dense, and inspectable. The interface should feel like the controlled working surface used during a serious incident review, with every action connected to an owner, state, and piece of evidence.

## Colors

Deep navy carries primary text and actions. Desaturated slate supports metadata and inactive states. Green marks confirmed progress, not decoration. Off-white surfaces distinguish working layers without shadows or glass effects.

## Typography

IBM Plex Sans keeps prose direct and readable. IBM Plex Mono is reserved for timestamps, identifiers, statuses, and evidence references. Hierarchy comes from weight and spacing more than dramatic scale.

## Layout

Use a compact 8-pixel rhythm, a persistent process rail, and a wide evidence pane. Related state and evidence stay spatially adjacent. Empty space should signal separation between responsibilities, not luxury.

## Elevation & Depth

Use borders, surface changes, and containment. Avoid floating cards and deep shadows; a controlled record should feel anchored.

## Shapes

Corners are modest and utilitarian. Status pills may be fully rounded only when their text remains visible. Avoid decorative geometry.

## Components

Primary buttons are dark and unambiguous. Evidence panels present source, timestamp, owner, and verification state together. Destructive actions remain visually distinct and always expose their approval requirement.

## Do's and Don'ts

- Do keep evidence beside the action it supports.
- Do use green only for confirmed states.
- Don't use gradients, glows, glass surfaces, or AI sparkle motifs.
- Don't hide qualifications in tooltips when they affect a decision.
