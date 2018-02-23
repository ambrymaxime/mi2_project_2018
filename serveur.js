/**
*
* VARIABLES
*
**/
var mysql = require('mysql');
var express = require('express');
var app = express();
var router = express.Router();
var path = require('path');
var server = require('http').createServer(app);
var io = require('socket.io')(server);

//var EtudiantModule = require('./Model/Etudiant.js');

var bodyParser = require('body-parser')

//Here we are configuring express to use body-parser as middle-ware.
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

var mysql = require('mysql');

// var UtilisateurModule = require('./model/Utilisateur.js');
var userDAO = require('./model/Utilisateur.js');
var questionnaireDAO = require('./model/Questionnaire.js');
var questionDAO = require('./model/Question.js');
var reponseDAO = require('./model/Reponse.js');

var user;


//Connexion BD
var connection = mysql.createConnection({
    host: '127.0.0.1',
    user: 'root',
    password: '',
    database: 'projet_web_dynamique'
});

connection.connect(function(err){
    if(err){
        console.log("Connexion échouée");
    }else{
        console.log("Connexion réussi");
    }
});

/**
*
* CORPS
*
**/

app.engine('ejs', require('ejs').renderFile);
app.set('view engine', 'ejs');
app.use('/style', express.static(path.join(__dirname + '/style')));
app.use('/model', express.static(path.join(__dirname + '/model')));
app.get('/', function(req, res) {
	res.setHeader('Content-Type', 'text/html');
	res.sendFile(path.join(__dirname + '/index.html'));
});
/**
*
* ROUTES
*
**/

router.use(function (req,res,next) {
  console.log("/" + req.method);
  next();
});

router.get("/questionnaire/creation",function(req,res){
  user.then(function(result) {
    var params = {};
    params.utilisateur = result;
    res.render('creation.ejs', params);
  });

});

router.post("/questionnaire/add",function(req,res){
  //Récupération des champs POST
  var params = {};
  //Questionnaire
  params.libelleQuestionnaire = req.body.libelleQuestionnaire;
  params.nbQuestion = req.body.nbQuestion;
  params.professor = req.body.professor;
  params.groupe = req.body.groupe;
  params.num = 0;

  //On créé un questionnaire
  var questionnaire = questionnaireDAO.insertQuestionnaire(connection, params.professor, params.libelleQuestionnaire, params.groupe);
  questionnaire.then(function(result) {
    //Si l'insertion s'est bien passée
    if (result) {
      var idQuestionnaire = result;
      //Pour ce questionnaire, on créé le nombre de question renseignées
      for (var i = 0; i < params.nbQuestion; i++) {
        //On créé la question avec des variables dynamiques..
        var question = questionDAO.insertQuestion(connection, req.body['libelleQuestion_'+(i+1)], req.body['typeQuestion_'+(i+1)], req.body['nbReponses_'+(i+1)], idQuestionnaire);
        question.then(function(result) {
          //Si la question est bien créée on créé les reponses
          if (result) {
            var idQuestion = result[0];
            var nbReponses = result[1];
            //Numéro de la question en cours
            params.num = params.num + 1;
            //Pour cette question, on créé le nombre de réponses renseignées avec des variables dynamiques
            for (var j = 0; j < nbReponses; j++) {
              //TODO. Paramètre type (reponse juste ou fausse) a changer en fonction des check box !
              var reponse = reponseDAO.insertReponse(connection, req.body['libelleQuestion_'+params.num+'Reponse_'+(j+1)], 0, idQuestion);
            }
          }
        });
      }
    }
  });
  //On redirige vers la liste en indiquant a nouveau l'utilisateur
  user = userDAO.getUtilisateurById(connection, params.professor);
  user.then(function(result) {
    var params = {};
    params.utilisateur = result;

    questionnaireDAO = require('./model/Questionnaire.js');
    var questionnaires = questionnaireDAO.getAllQuestionnaire(connection);
    questionnaires.then(function(result){
      params.questionnaires = result;
      res.render('professeur.ejs', params);
    });

  });

});

router.post("/accueil",function(req,res){
  //Récupération des champs POST
  var params = {};

  params.pseudo = req.body.pseudo;
  params.password = req.body.password;
  //Création d'un utilisateur
  user = userDAO.getUtilisateurByPseudoPassword(connection, params.pseudo, params.password);
  user.then(function(result) {
    var params = {};
    params.utilisateur = result;
    //Si c'est un prof on redirige vers son interface
    if (result.role) {
      // Récupération de tous les questionnaires
      questionnaireDAO = require('./model/Questionnaire.js');
      var questionnaires = questionnaireDAO.getAllQuestionnaire(connection);
      questionnaires.then(function(result){
        params.questionnaires = result;
        res.render('professeur.ejs', params);
      });
    }
    //Sinon c'est un eleve, et on redirige vers son interface
    else {
      // Récupération de l'objet Groupe
      groupeDAO = require('./model/Groupe.js');
      var groupe = groupeDAO.getGroupeById(connection, result.groupe);
      groupe.then(function(result){
        params.oGroupe = result;
      });

      // Récupération des questionnaires associées à l'élève
      questionnaireDAO = require('./model/Questionnaire.js');
      var questionnaires = questionnaireDAO.getQuestionnaireByGroupe(connection, result.groupe);
      questionnaires.then(function(result){
        params.questionnaires = result;
        //Récupération du nombre de question pour chaque questionnaire
        // params.nbq = [];
        // for (var i = 0; i < params.questionnaires.length; i++) {
        //   var nbQuestion = questionnaireDAO.getNbQuestionByQuestionnaire(connection, params.questionnaires[i].id);
        //   nbQuestion.then(function(res){
        //     params.nbq.push(res);
        //     console.log(res);
        //   });
        // }
        res.render('eleve.ejs', params);
      });
    }
  });

});

router.get("/questionnaire/:idQuestionnaire/lobby",function(req,res){
  var params = {};
  params.idQuestionnaire = req.params.idQuestionnaire;
  res.render('lobby.ejs', params);
});

router.get("/questionnaire/:idQuestionnaire/:idQuestion",function(req,res){
  var params = {};
  params.idQuestionnaire = req.params.idQuestionnaire;
  params.idQuestion = req.params.idQuestion;
  res.render('questionnaire.ejs', params);
});

//Stats de la question
router.get("/questionnaire/:idQuestionnaire/:idQuestion/stats",function(req,res){
  var params = {};
  params.idQuestionnaire = req.params.idQuestionnaire;
  params.idQuestion = req.params.idQuestion;
  res.render('stats.ejs', params);
});

//Stats global
router.get("/questionnaire/:idQuestionnaire/stats",function(req,res){
  var params = {};
  params.idQuestionnaire = req.params.idQuestionnaire;
  res.render('stats.ejs', params);
});

/**
*
* DATABASE
*
**/

// var connection = mysql.createConnection({
//   host : 'localhost',
//   user : 'root',
//   password : '',
//   database : 'projet_web_dynamique'
// });

// connection.connect( function(err) {
//   if (err) throw err;
//   console.log("Connected!");
// });
//
// var etudiant = new EtudiantModule("Ambry","Maxime");
// etudiant.createInDB(connection);

/**
*
* BUILD
*
**/
app.use("/",router);
app.use("/api",router);
app.use("*",function(req,res){
  res.render('404.ejs');
  // res.sendFile(__dirname + "/public/404.ejs");
});

// Quand un client se connecte, on le note dans la console

io.sockets.on('connection', function (socket) {

  socket.on('info', function(message){
    console.log(message.user + message.text);
  })

  socket.on('connexion', function(message){
    console.log(message);
    socket.broadcast.emit('message', 'Message à toutes les unités. Je répète, message à toutes les unités.');
  });
});

server.listen(8080);
