# Custom NER with spaCy

## Training a Custom NER Model

```python
import spacy
from spacy.training import Example
from spacy.util import minibatch, compounding
import random
from pathlib import Path


TRAIN_DATA = [
    ("Объект расположен в Москве", {"entities": [(22, 28, "LOC")]}),
    ("Дефект типа трещина обнаружен", {"entities": [(12, 19, "DEFECT_TYPE")]}),
]


def train_ner(output_dir: Path, n_iter: int = 30) -> None:
    nlp = spacy.blank("ru")
    ner = nlp.add_pipe("ner")

    for _, annotations in TRAIN_DATA:
        for ent in annotations["entities"]:
            ner.add_label(ent[2])

    nlp.initialize()
    optimizer = nlp.begin_training()

    for itn in range(n_iter):
        random.shuffle(TRAIN_DATA)
        losses: dict = {}
        batches = minibatch(TRAIN_DATA, size=compounding(4.0, 32.0, 1.001))

        for batch in batches:
            examples = []
            for text, annotations in batch:
                doc = nlp.make_doc(text)
                examples.append(Example.from_dict(doc, annotations))
            nlp.update(examples, drop=0.5, losses=losses, sgd=optimizer)

    nlp.to_disk(output_dir)
```

## Loading and Using Custom Model

```python
import spacy

nlp = spacy.load("models/custom-ner-ru")
doc = nlp("Трещина шириной 2мм обнаружена в Москве")

for ent in doc.ents:
    print(ent.text, ent.label_, ent.start_char, ent.end_char)
```

## Evaluation

```python
from spacy.scorer import Scorer
from spacy.training import Example

scorer = Scorer()
examples = [Example.from_dict(nlp(text), ann) for text, ann in TEST_DATA]
scores = scorer.score(examples)
print(f"NER F1: {scores['ents_f']:.3f}")
```
