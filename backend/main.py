from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from datetime import datetime, timedelta
from typing import List

from fastapi.middleware.cors import CORSMiddleware
import models, schemas, auth, database
from database import engine, get_db

models.Base.metadata.create_all(bind=engine)

app = FastAPI(title="G-ACT API")

# Configuration CORS pour permettre au frontend de communiquer avec l'API
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # À restreindre en production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def read_root():
    return {"message": "Bienvenue sur l'API G-ACT (Good Action) ! Accédez à /docs pour la documentation."}

@app.post("/register", response_model=schemas.User)
def register_user(user: schemas.UserCreate, db: Session = Depends(get_db)):
    db_user = db.query(models.User).filter(models.User.email == user.email).first()
    if db_user:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    db_user_pseudo = db.query(models.User).filter(models.User.pseudo == user.pseudo).first()
    if db_user_pseudo:
        raise HTTPException(status_code=400, detail="Pseudo already taken")

    hashed_password = auth.get_password_hash(user.password)
    new_user = models.User(
        email=user.email,
        pseudo=user.pseudo,
        password_hash=hashed_password
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return new_user

@app.post("/token", response_model=schemas.Token)
async def login_for_access_token(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.pseudo == form_data.username).first()
    if not user or not auth.verify_password(form_data.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    access_token_expires = timedelta(minutes=auth.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = auth.create_access_token(
        data={"sub": user.pseudo}, expires_delta=access_token_expires
    )
    return {"access_token": access_token, "token_type": "bearer"}

@app.get("/users/me", response_model=schemas.User)
async def read_users_me(current_user: str = Depends(auth.get_current_user), db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.pseudo == current_user).first()
    return user

@app.post("/actions", response_model=schemas.Action)
def create_action(action: schemas.ActionCreate, current_user: str = Depends(auth.get_current_user), db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.pseudo == current_user).first()
    
    # Logique de Streak et Score
    now = datetime.now()
    
    # 1. Mise à jour du Score (+50 par action)
    user.score_global += 50
    
    # 2. Gestion de la Streak
    if user.last_action_date:
        last_date = user.last_action_date.date()
        today = now.date()
        
        # Si c'est le lendemain, on augmente la streak
        if today == last_date + timedelta(days=1):
            user.streak += 1
        # Si on a sauté plus d'un jour, la streak retombe à 1
        elif today > last_date + timedelta(days=1):
            user.streak = 1
        # Si c'est le même jour, on ne change pas la streak
    else:
        # Première action à vie
        user.streak = 1
        
    user.last_action_date = now

    # Création de l'action
    new_action = models.Action(
        **action.dict(),
        author_id=user.id,
        created_at=now
    )
    
    db.add(new_action)
    db.commit()
    db.refresh(new_action)
    return new_action

@app.get("/actions", response_model=List[schemas.Action])
def get_actions(skip: int = 0, limit: int = 10, db: Session = Depends(get_db)):
    actions = db.query(models.Action).offset(skip).limit(limit).all()
    return actions

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
