import { createRequire } from "module";
const require = createRequire(import.meta.url);
const questionsJSON = require("../json/questions.json");
const adminsJSON = require("../json/rules.json");
const rulesJSON = require("../json/rules.json");
const { RULES } = rulesJSON;
const { ADMINS } = adminsJSON;
var { QUESTIONS: questions } = questionsJSON;

var GEN1Questions = questions.filter((item) => item.category === "GEN1");
var GEN2Questions = questions.filter((item) => item.category === "GEN2");
var GEN3Questions = questions.filter((item) => item.category === "GEN3");

const GEN1_COUNT = 5;
const GEN2_COUNT = 5;
const GEN3_COUNT = 5;

const RandomPicker = (array, count) => {
  let picked = [];
  while (picked.length < count) {
    let b = ~~(Math.random() * array.length);
    if (!picked.includes(array[b])) {
      picked.push(array[b]);
      if (picked.length === count) break;
    }
  }
  if (picked.length !== count) {
    console.log("ERROR: EXTRA QUESTIONS ARE CREATED WITHOUT INTENSION!");
    return picked.splice(0, picked.length - count);
  }
  return picked;
};

export const QuestionPicker = () => {
  let pickedQuestions = [];
  pickedQuestions = [
    ...RandomPicker(GEN1Questions, GEN1_COUNT),
    ...RandomPicker(GEN2Questions, GEN2_COUNT),
    ...RandomPicker(GEN3Questions, GEN3_COUNT),
  ];
  pickedQuestions.sort(() => 0.5 - Math.random());
  pickedQuestions.map((item) => {
    if (pickedQuestions.filter((x) => item.id === x).length > 1) {
      pickedQuestions = [];
      return console.error("ERROR: DUPLICATED QUESTIONS");
    }
    delete item.answerid;
    delete item.status;
    item.options.sort(() => 0.5 - Math.random());
  });
  return pickedQuestions;
};

let AnswerSheet = [];

questions.map((item) => {
  const answer = { id: item.id, answerid: item.answerid };
  AnswerSheet.push(answer);
});
export const TestValidator = (test) => {
  let ValidTest = test;
  let correct = 0;
  ValidTest.map((item) => {
    let answerid = AnswerSheet.find((xItem) => xItem.id === item.id).answerid;
    item.selected === answerid && correct++;
  });
  let wrong = GEN1_COUNT + GEN2_COUNT + GEN3_COUNT - correct;
  return { test: ValidTest, correct, wrong };
};

export const Rules = () => {
  return RULES;
};


export const Admins = () => {
  return ADMINS
}