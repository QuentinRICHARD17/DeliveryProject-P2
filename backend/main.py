from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from datetime import datetime, timedelta
from typing import List
import random
import json
import os
import base64

from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import models, schemas, auth, database
from database import engine, get_db

models.Base.metadata.create_all(bind=engine)

app = FastAPI(title="G-ACT API")

# Dossier pour les uploads
UPLOAD_DIR = os.path.join(os.path.dirname(__file__), "uploads")
if not os.path.exists(UPLOAD_DIR):
    os.makedirs(UPLOAD_DIR)

# Servir les fichiers statiques
app.mount("/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")

# Configuration CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- CHARGEMENT DU REGISTRE DES BADGES ---
BADGES_REGISTRY = {}
try:
    registry_path = os.path.join(os.path.dirname(__file__), "badges_registry.json")
    with open(registry_path, "r", encoding="utf-8") as f:
        BADGES_REGISTRY = json.load(f)
except Exception as e:
    print(f"Erreur chargement registre badges: {e}")

PINS_BY_RARITY = {
    "common": [k for k, v in BADGES_REGISTRY.items() if v["rarity"] == "common"],
    "rare": [k for k, v in BADGES_REGISTRY.items() if v["rarity"] == "rare"],
    "epic": [k for k, v in BADGES_REGISTRY.items() if v["rarity"] == "epic"],
    "legendary": [k for k, v in BADGES_REGISTRY.items() if v["rarity"] == "legendary"]
}

CHEST_COSTS = {
    "commun": 100,
    "rare": 250,
    "epique": 500,
    "legendaire": 1000
}

PROBS = {
    "commun": [0.80, 0.15, 0.05, 0.00],
    "rare": [0.50, 0.40, 0.08, 0.02],
    "epique": [0.20, 0.40, 0.30, 0.10],
    "legendaire": [0.00, 0.20, 0.50, 0.30]
}

@app.get("/")
def read_root():
    return {"message": "Bienvenue sur l'API G-ACT ! Documentation sur /docs"}

@app.post("/register", response_model=schemas.User)
def register_user(user: schemas.UserCreate, db: Session = Depends(get_db)):
    db_user = db.query(models.User).filter(models.User.email == user.email).first()
    if db_user:
        raise HTTPException(status_code=400, detail="Email already registered")
    db_user_pseudo = db.query(models.User).filter(models.User.pseudo == user.pseudo).first()
    if db_user_pseudo:
        raise HTTPException(status_code=400, detail="Pseudo already taken")

    hashed_password = auth.get_password_hash(user.password)
    new_user = models.User(email=user.email, pseudo=user.pseudo, password_hash=hashed_password)
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return new_user

@app.post("/token", response_model=schemas.Token)
async def login_for_access_token(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.pseudo == form_data.username).first()
    if not user or not auth.verify_password(form_data.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Incorrect username or password")
    access_token = auth.create_access_token(data={"sub": user.pseudo}, expires_delta=timedelta(minutes=auth.ACCESS_TOKEN_EXPIRE_MINUTES))
    return {"access_token": access_token, "token_type": "bearer"}

@app.get("/users/me", response_model=schemas.User)
async def read_users_me(current_user: str = Depends(auth.get_current_user), db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.pseudo == current_user).first()
    my_actions = db.query(models.Action).filter(models.Action.author_id == user.id).all()
    total_up = sum([a.upvotes for a in my_actions])
    total_down = sum([a.downvotes for a in my_actions])
    total_votes = total_up + total_down
    user.trust_score = (total_up / total_votes * 100) if total_votes > 0 else 100.0
    _ = user.badges
    return user

@app.post("/actions/{action_id}/vote")
def vote_action(action_id: int, vote: schemas.VoteCreate, current_user: str = Depends(auth.get_current_user), db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.pseudo == current_user).first()
    action = db.query(models.Action).filter(models.Action.id == action_id).first()
    if not action: raise HTTPException(status_code=404, detail="Action non trouvée")
    if action.author_id == user.id: raise HTTPException(status_code=400, detail="On ne peut pas voter pour soi-même")
    existing_vote = db.query(models.Vote).filter(models.Vote.user_id == user.id, models.Vote.action_id == action_id).first()
    if existing_vote: raise HTTPException(status_code=400, detail="Déjà voté")

    new_vote = models.Vote(user_id=user.id, action_id=action_id, vote_type=vote.vote_type)
    db.add(new_vote)
    if vote.vote_type == "up": action.upvotes += 1
    else: action.downvotes += 1
    if action.upvotes >= 2: action.status = "validated"
    elif action.downvotes >= 2: action.status = "rejected"
    db.commit()
    return {"message": "Vote enregistré"}

@app.get("/users/me/actions", response_model=List[schemas.Action])
def get_my_actions(current_user: str = Depends(auth.get_current_user), db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.pseudo == current_user).first()
    actions = db.query(models.Action).filter(models.Action.author_id == user.id).order_by(models.Action.created_at.desc()).all()
    for a in actions: a.author_pseudo = user.pseudo
    return actions

@app.post("/actions", response_model=schemas.Action)
def create_action(action: schemas.ActionCreate, current_user: str = Depends(auth.get_current_user), db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.pseudo == current_user).first()
    now = datetime.now()
    user.score_global += 50
    if user.last_action_date:
        if now.date() == user.last_action_date.date() + timedelta(days=1): user.streak += 1
        elif now.date() > user.last_action_date.date() + timedelta(days=1): user.streak = 1
    else: user.streak = 1
    user.last_action_date = now
    new_action = models.Action(category=action.category, description=action.description, author_id=user.id, created_at=now, photo_url="")
    db.add(new_action)
    db.commit()
    db.refresh(new_action)
    try:
        if action.photo_url.startswith('data:image'):
            header, encoded = action.photo_url.split(",", 1)
            data = base64.b64decode(encoded)
            filename = f"action_{new_action.id}.png"
            with open(os.path.join(UPLOAD_DIR, filename), "wb") as f: f.write(data)
            new_action.photo_url = f"http://127.0.0.1:8000/uploads/{filename}"
            db.commit()
            db.refresh(new_action)
    except Exception as e: print(f"Erreur image: {e}")
    new_action.author_pseudo = user.pseudo
    return new_action

@app.get("/actions", response_model=List[schemas.Action])
def get_community_actions(current_user: str = Depends(auth.get_current_user), db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.pseudo == current_user).first()
    seen = [v.action_id for v in db.query(models.Vote).filter(models.Vote.user_id == user.id).all()]
    actions = db.query(models.Action).filter(models.Action.author_id != user.id, models.Action.id.not_in(seen) if seen else True, models.Action.status == "pending").limit(10).all()
    for a in actions:
        author = db.query(models.User).filter(models.User.id == a.author_id).first()
        a.author_pseudo = author.pseudo if author else "Inconnu"
    return actions

@app.delete("/actions/{action_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_action(action_id: int, current_user: str = Depends(auth.get_current_user), db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.pseudo == current_user).first()
    action = db.query(models.Action).filter(models.Action.id == action_id, models.Action.author_id == user.id).first()
    if not action: raise HTTPException(status_code=404)
    if action.photo_url and "http://127.0.0.1:8000/uploads/" in action.photo_url:
        path = os.path.join(UPLOAD_DIR, action.photo_url.split("/")[-1])
        if os.path.exists(path): os.remove(path)
    db.delete(action)
    db.commit()
    return None

@app.post("/setup-test-data")
def setup_test_data(db: Session = Depends(get_db)):
    wazuma = db.query(models.User).filter(models.User.pseudo == "Wazuma").first()
    if not wazuma:
        wazuma = models.User(pseudo="Wazuma", email="w@t.com", password_hash=auth.get_password_hash("p"), score_global=100)
        db.add(wazuma); db.commit(); db.refresh(wazuma)
    acts = [{"c": "Écologie", "d": "Test 1"}, {"c": "Social", "d": "Test 2"}]
    for a in acts:
        if not db.query(models.Action).filter(models.Action.description == a["d"]).first():
            db.add(models.Action(author_id=wazuma.id, category=a["c"], description=a["d"], photo_url=f"https://picsum.photos/seed/{a['c']}/400/300"))
    db.commit()
    return {"message": "OK"}

# --- ADMIN ---
@app.get("/admin/users", response_model=List[schemas.User])
def admin_get_users(db: Session = Depends(get_db)): return db.query(models.User).all()

@app.put("/admin/users/{user_id}")
def admin_update_user(user_id: int, data: dict, db: Session = Depends(get_db)):
    u = db.query(models.User).filter(models.User.id == user_id).first()
    if u:
        u.score_global = data.get("score_global", u.score_global)
        u.streak = data.get("streak", u.streak)
        db.commit()
    return {"msg": "OK"}

@app.delete("/admin/users/{user_id}", status_code=204)
def admin_delete_user(user_id: int, db: Session = Depends(get_db)):
    db.query(models.Action).filter(models.Action.author_id == user_id).delete()
    db.query(models.Vote).filter(models.Vote.user_id == user_id).delete()
    db.query(models.User).filter(models.User.id == user_id).delete()
    db.commit()
    return None

@app.get("/admin/actions", response_model=List[schemas.Action])
def admin_get_actions(db: Session = Depends(get_db)):
    actions = db.query(models.Action).all()
    for a in actions:
        author = db.query(models.User).filter(models.User.id == a.author_id).first()
        a.author_pseudo = author.pseudo if author else "Inconnu"
    return actions

@app.put("/admin/actions/{action_id}", response_model=schemas.Action)
def admin_update_action(action_id: int, data: dict, db: Session = Depends(get_db)):
    a = db.query(models.Action).filter(models.Action.id == action_id).first()
    if a:
        a.upvotes = int(data.get("upvotes", a.upvotes))
        a.downvotes = int(data.get("downvotes", a.downvotes))
        if a.upvotes >= 2: a.status = "validated"
        elif a.downvotes >= 2: a.status = "rejected"
        else: a.status = "pending"
        db.commit(); db.refresh(a)
        author = db.query(models.User).filter(models.User.id == a.author_id).first()
        a.author_pseudo = author.pseudo if author else "Inconnu"
        return a
    raise HTTPException(status_code=404)

@app.post("/admin/actions/reset-votes")
def admin_reset_votes(db: Session = Depends(get_db)):
    db.query(models.Vote).delete()
    for a in db.query(models.Action).all():
        a.upvotes = 0; a.downvotes = 0; a.status = "pending"
    db.commit()
    return {"msg": "OK"}

@app.post("/admin/login-as/{pseudo}")
def admin_login_as(pseudo: str, db: Session = Depends(get_db)):
    u = db.query(models.User).filter(models.User.pseudo == pseudo).first()
    if not u: raise HTTPException(404)
    return {"access_token": auth.create_access_token({"sub": u.pseudo}), "token_type": "bearer"}

@app.get("/admin/badges-registry")
def get_badges_registry(): return BADGES_REGISTRY

@app.put("/admin/users/{user_id}/badges")
def admin_update_badges(user_id: int, badge_names: List[str], db: Session = Depends(get_db)):
    db.query(models.Badge).filter(models.Badge.user_id == user_id).delete()
    for name in badge_names: db.add(models.Badge(user_id=user_id, badge_name=name))
    db.commit()
    return {"msg": "OK"}

@app.post("/chests/open/{rarity}")
def open_chest(rarity: str, current_user: str = Depends(auth.get_current_user), db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.pseudo == current_user).first()
    if rarity not in CHEST_COSTS: raise HTTPException(400)
    cost = CHEST_COSTS[rarity]
    if user.score_global < cost: raise HTTPException(400, "Points insuffisants")
    user.score_global -= cost
    roll = random.random()
    p = PROBS[rarity]
    if roll < p[0]: win_rarity = "common"
    elif roll < p[0] + p[1]: win_rarity = "rare"
    elif roll < p[0] + p[1] + p[2]: win_rarity = "epic"
    else: win_rarity = "legendary"
    badge_id = random.choice(PINS_BY_RARITY[win_rarity])
    badge_info = BADGES_REGISTRY[badge_id]
    existing = db.query(models.Badge).filter(models.Badge.user_id == user.id, models.Badge.badge_name == badge_info["file"]).first()
    is_duplicate = existing is not None
    if not is_duplicate: db.add(models.Badge(user_id=user.id, badge_name=badge_info["file"]))
    db.commit(); db.refresh(user)
    return {"pin_file": badge_info["file"], "badge_name": badge_info["name"], "rarity": win_rarity, "new_score": user.score_global, "is_duplicate": is_duplicate}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
