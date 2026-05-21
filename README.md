# G-ACT (Good Action)

Application web (PWA) pour transformer les bonnes actions en habitudes grâce à la gamification.

## Architecture

- **Frontend**: HTML/CSS/JS (Vanilla)
- **Backend**: Python (FastAPI) + SQLite

## Installation du Backend

1. Naviguer dans le dossier backend :
   ```bash
   cd backend
   ```
2. Créer un environnement virtuel :
   ```bash
   python -m venv venv
   ```
3. Activer l'environnement virtuel :
   - Windows : `venv\\Scripts\\activate`
   - Linux/macOS : `source venv/bin/activate`
4. Installer les dépendances :
   ```bash
   pip install -r requirements.txt
   ```
5. Lancer le serveur :
   ```bash
   uvicorn main:app --reload
   ```

Le serveur sera accessible sur `http://127.0.0.1:8000`.
La documentation interactive de l'API est disponible sur `http://127.0.0.1:8000/docs`.
