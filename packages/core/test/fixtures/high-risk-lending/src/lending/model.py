from sklearn.ensemble import GradientBoostingClassifier
from sklearn.model_selection import train_test_split
import openai

def train_model(data, labels):
    X_train, X_test, y_train, y_test = train_test_split(data, labels)
    model = GradientBoostingClassifier()
    model.fit(X_train, y_train)
    return model

def assess_loan(application):
    score = model.predict_proba([application])[0][1]
    return {"approved": score > 0.7, "score": score}
