# UrbanFlow

**Road Disruption Simulation to Mitigate Roadwork and Event-Induced Congestion in Urban Areas using Random Forest Algorithm**

UrbanFlow is a data-driven traffic disruption simulation and forecasting system developed for Calamba City. It predicts congestion severity caused by temporary road disruptions such as roadworks and large public events, and provides geospatial visualization to support evidence-based traffic planning.

---

## Overview

Urban traffic congestion caused by roadworks and public events is a major challenge in rapidly urbanizing cities. Existing tools often lack localized, reliable forecasting capabilities. UrbanFlow addresses this gap by leveraging machine learning to predict congestion levels and simulate disruption impacts in real time.

---

## Features

- **Congestion Severity Prediction** — Classifies traffic into Light, Moderate, and Heavy congestion using a Random Forest model
- **Interactive Geospatial Map** — Visualizes predicted congestion and affected road segments with color-coded severity indicators (green / yellow / red)
- **Travel Time Delay Estimates** — Provides hourly delay forecasts for disrupted routes
- **Disruption Simulation** — Supports planned (roadwork, events) and unplanned (accidents, flooding) disruption scenarios
- **Disruption Publishing** — Authorized users can publish disruptions with OTP verification
- **Report Generation** — Exports comprehensive simulation results for decision-making
- **Dual Access Levels** — Separate views for authorized traffic planners and general road users

---

## Algorithm

UrbanFlow uses a **Random Forest** machine learning model trained on:

- Historical traffic volume data from DPWH Regional Office IV-A (2024 Annual Average Daily Traffic)
- Disruption records from Calamba City

**Model Highlights:**
- 80–20 stratified train-test split
- Hyperparameter optimization (training-only)
- Class imbalance mitigation via **SMOTE** and class-weighted learning
- Strong macro-averaged and weighted F1-scores
- Substantial Cohen's Kappa coefficient

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js, React, Leaflet.js |
| Backend | Python Flask |
| Machine Learning | Python, Scikit-learn (Random Forest) |
| Database | PostgreSQL with PostGIS |
| Traffic Data | TomTom Traffic Flow API |
| Deployment | Vercel, Supabase, DigitalOcean |

---

## System Architecture

UrbanFlow consists of three core components:

1. **Frontend Layer** — Built using Next.js and React, with Leaflet.js handling interactive geospatial mapping and congestion visualization.
2. **Backend Layer** — Developed using Python Flask, connected to a PostgreSQL database with PostGIS extensions for geospatial data processing.
3. **Machine Learning Layer** — Implemented using Scikit-learn's Random Forest algorithm, with real-time traffic data integrated via the TomTom Traffic Flow API.

The system is deployed across Vercel (frontend), Supabase, and DigitalOcean (backend and database).

---

## Researchers

- **Fate-Lyn P. Almario**
- **Edzon D. Deveras**
- **Nazreen L. Villanueva**

**Adviser:** Mr. Percival A. Fernandez

School of Computer Studies and Technology
Colegio de San Juan de Letran Calamba — January 2026

---

## Acknowledgements

Special thanks to the **Department of Public Works and Highways (DPWH) Regional Office IV-A**, the **Calamba City Public Order and Safety Office (CCPOSO)**, our thesis panelists, and our families for their invaluable support throughout this study.

---

## License

This project was developed for academic purposes.



