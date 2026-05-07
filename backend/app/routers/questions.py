import json
from datetime import date
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from ..database import get_db
from ..models.goal import LearningGoal
from ..models.roadmap import Roadmap
from ..models.question import DailyQuestion, UserAnswer
from ..schemas.api import AnswerSubmit, QuestionResponse, AnswerResponse
from ..services.ai_service import chat_json
from ..services.prompt_templates import generate_questions, evaluate_answer

router = APIRouter(prefix='/api', tags=['questions'])


def _question_to_response(q: DailyQuestion) -> dict:
    return {'id': q.id, 'goal_id': q.goal_id, 'date': str(q.date),
            'question': q.question, 'expected_answer': q.expected_answer,
            'difficulty': q.difficulty, 'status': q.status,
            'created_at': q.created_at.isoformat()}


@router.get('/goals/{goal_id}/questions', response_model=list[QuestionResponse])
def get_questions(goal_id: int, target_date: str = Query(None, alias='date'), db: Session = Depends(get_db)):
    qdate = target_date if target_date else str(date.today())
    questions = db.query(DailyQuestion).filter(
        DailyQuestion.goal_id == goal_id, DailyQuestion.date == qdate
    ).all()
    return [_question_to_response(q) for q in questions]


@router.post('/goals/{goal_id}/questions/generate', response_model=list[QuestionResponse])
def gen_questions(goal_id: int, db: Session = Depends(get_db)):
    g = db.query(LearningGoal).filter(LearningGoal.id == goal_id).first()
    if not g:
        raise HTTPException(status_code=404, detail='目标不存在')

    rm = db.query(Roadmap).filter(Roadmap.goal_id == goal_id, Roadmap.is_active == True).first()
    if not rm:
        raise HTTPException(status_code=400, detail='请先生成学习路线')

    roadmap_data = json.loads(rm.content) if isinstance(rm.content, str) else rm.content
    phases = roadmap_data.get('phases', [])
    current_topic = '开始阶段'
    if phases:
        for p in phases:
            if p.get('topics'):
                current_topic = p['title'] + ' - ' + p['topics'][0].get('title', '')
                break

    # 获取最近评分来调整难度
    recent_answers = db.query(UserAnswer).join(DailyQuestion).filter(
        DailyQuestion.goal_id == goal_id
    ).order_by(UserAnswer.created_at.desc()).limit(3).all()
    avg_score = sum(a.score for a in recent_answers if a.score) / max(len([a for a in recent_answers if a.score]), 1)
    difficulty = 'medium' if avg_score >= 6 else 'easy' if avg_score < 4 else 'medium'

    try:
        result = chat_json([{'role': 'user', 'content': generate_questions(
            goal_title=g.title, current_topic=current_topic, difficulty=difficulty
        )}])
    except Exception:
        raise HTTPException(status_code=500, detail='AI 生成问题失败')

    today = date.today()
    questions = []
    for q_data in result.get('questions', []):
        q = DailyQuestion(
            goal_id=goal_id, date=today,
            question=q_data['question'],
            expected_answer=q_data.get('expected_answer', ''),
            difficulty=q_data.get('difficulty', 'medium'),
        )
        db.add(q)
        db.flush()
        questions.append(_question_to_response(q))
    db.commit()
    return questions


@router.post('/questions/{question_id}/answer', response_model=AnswerResponse)
def submit_answer(question_id: int, data: AnswerSubmit, db: Session = Depends(get_db)):
    q = db.query(DailyQuestion).filter(DailyQuestion.id == question_id).first()
    if not q:
        raise HTTPException(status_code=404, detail='问题不存在')

    # AI 评估
    g = db.query(LearningGoal).filter(LearningGoal.id == q.goal_id).first()
    try:
        evaluation = chat_json([{'role': 'user', 'content': evaluate_answer(
            goal_title=g.title if g else '',
            question=q.question,
            expected_answer=q.expected_answer,
            user_answer=data.answer,
        )}], temperature=0.3)
    except Exception:
        evaluation = {'score': None, 'correctness': '评估失败', 'depth': '', 'suggestion': '', 'need_adjust': False}

    answer = UserAnswer(
        question_id=question_id, answer=data.answer,
        ai_evaluation=json.dumps(evaluation, ensure_ascii=False),
        score=evaluation.get('score'),
    )
    db.add(answer)

    q.status = 'answered'
    db.commit()
    db.refresh(answer)
    return {
        'id': answer.id, 'question_id': answer.question_id,
        'answer': answer.answer,
        'ai_evaluation': evaluation,
        'score': answer.score,
        'created_at': answer.created_at.isoformat(),
    }


@router.get('/goals/{goal_id}/questions/history')
def questions_history(goal_id: int, db: Session = Depends(get_db)):
    questions = db.query(DailyQuestion).filter(
        DailyQuestion.goal_id == goal_id
    ).order_by(DailyQuestion.date.desc()).limit(30).all()
    result = []
    for q in questions:
        answers = db.query(UserAnswer).filter(UserAnswer.question_id == q.id).all()
        result.append({
            **_question_to_response(q),
            'answers': [{
                'id': a.id, 'answer': a.answer,
                'ai_evaluation': json.loads(a.ai_evaluation) if a.ai_evaluation and isinstance(a.ai_evaluation, str) else a.ai_evaluation,
                'score': a.score, 'created_at': a.created_at.isoformat(),
            } for a in answers],
        })
    return result
