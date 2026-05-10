from sqlmodel import SQLModel, Session, create_engine

# adjust the URL to your DB
DATABASE_URL = "sqlite:///./talenthub.db"

engine = create_engine(DATABASE_URL, echo=False)


def init_db():
    SQLModel.metadata.create_all(engine)
    print (" successfully created database engine and connecton established successfully")


def get_session():
    with Session(engine) as session:
        yield session
