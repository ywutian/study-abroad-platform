# Feature: Essay AI

## Purpose

AI-powered essay evaluation with radar chart scoring and brainstorming dialog.

## Components

- AIScoreRadar — radar chart visualizing essay scores across dimensions
- ScoreDetailList — detailed breakdown of each scoring dimension
- ScoreBadge — inline score indicator badge
- EssayBrainstormDialog — dialog for AI-assisted essay topic brainstorming

## Data Flow

- API: `POST /essays/:id/evaluate`, `POST /essays/brainstorm`
- ScoreDimension type defines dimension name + score + feedback

## Patterns

- Recharts-based radar visualization
- Dialog pattern for brainstorm interaction
- Exports both components and types via barrel index
