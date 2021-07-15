// See https://github.com/dialogflow/dialogflow-fulfillment-nodejs
// for Dialogflow fulfillment library docs, samples, and to report issues
'use strict';
 
const functions = require('firebase-functions');
const {WebhookClient} = require('dialogflow-fulfillment');
const {Card, Suggestion} = require('dialogflow-fulfillment');
const firebaseAdmin = require('firebase-admin');

process.env.DEBUG = 'dialogflow:debug'; // enables lib debugging statements

firebaseAdmin.initializeApp({
    credential: firebaseAdmin.credential.applicationDefault(),
    databaseURL: 'ws://ice-cream-service-aywq-default-rtdb.firebaseio.com/'
});

var cupPrice, scoopPrice, sugarPrice, toppingPrice, wafflePrice;
firebaseAdmin.database().ref('Prices').on('value', function(snapshot){
    cupPrice = snapshot.val().cupPrice;
});

firebaseAdmin.database().ref('Prices').on('value', function(snapshot){
    scoopPrice = snapshot.val().scoopPrice;
});

firebaseAdmin.database().ref('Prices').on('value', function(snapshot){
    sugarPrice = snapshot.val().sugarPrice;
});

firebaseAdmin.database().ref('Prices').on('value', function(snapshot){
    toppingPrice = snapshot.val().toppingPrice;
});

firebaseAdmin.database().ref('Prices').on('value', function(snapshot){
    wafflePrice = snapshot.val().wafflePrice;
});

exports.dialogflowFirebaseFulfillment = functions.https.onRequest((request, response) => {
  const agent = new WebhookClient({ request, response });
  console.log('Dialogflow Request headers: ' + JSON.stringify(request.headers));
  console.log('Dialogflow Request body: ' + JSON.stringify(request.body));
 
  function welcome(agent) {
    agent.add(`Welcome to my agent!`);
  }
 
  function fallback(agent) {
    agent.add(`I didn't understand`);
    agent.add(`I'm sorry, can you try again?`);
  }

  function order(agent) {
    let price = 0;
    let containerPrice = 0;
    const scoops = agent.parameters.numScoops;
    const toppings = agent.parameters.toppings;
    const container = agent.parameters.container;
    const flavor = agent.parameters.flavor;
    if(container==='cup')
      containerPrice = cupPrice;
    if(container==='waffle cone')
      containerPrice = wafflePrice;
    if(container==='sugar cone')
      containerPrice = sugarPrice;
    price = (scoopPrice * scoops) + (toppingPrice * toppings.length) + containerPrice;
    agent.add("Great! You have ordered " + scoops + " scoops of " + flavor + " ice cream in a " + container + " with " + toppings + "." +
                                                                      " This order will cost $" + price + ". Have a great day!");
  }

  function priceChange(agent) {
      const newPrice = agent.parameters.newPrice.amount;
      const item = agent.parameters.item;
      
      if(item === 'waffle cone'){
        firebaseAdmin.database().ref('Prices').update({
            wafflePrice: newPrice
        });
      }
      if(item === 'sugar cone'){
        firebaseAdmin.database().ref('Prices').update({
            sugarPrice: newPrice
        });
      }
      if(item === 'cup'){
        firebaseAdmin.database().ref('Prices').update({
            cupPrice: newPrice
        });
      }
      if(item === 'scoop'){
        firebaseAdmin.database().ref('Prices').update({
            scoopPrice: newPrice
        });
      }
      if(item === 'topping'){
        firebaseAdmin.database().ref('Prices').update({
            toppingPrice: newPrice
        });
      }
  }

  function getPrice(agent) {
      let price = 0;
      const item = agent.parameters.getCostOf;
      if(item === 'waffle cone')
        price = wafflePrice;
      if(item === 'sugar cone')
        price = sugarPrice;
      if(item === 'cup')
        price = cupPrice;
      if(item === 'scoop')
        price = scoopPrice;
      if(item === 'topppings')
        price = toppingPrice;
      agent.add('The price of each ' + item + ' is $' + price + '.');
  }

  // Run the proper function handler based on the matched Dialogflow intent name
  let intentMap = new Map();
  intentMap.set('Default Welcome Intent', welcome);
  intentMap.set('Default Fallback Intent', fallback);
  intentMap.set('Order Ice Cream', order);
  intentMap.set('Change Price', priceChange);
  intentMap.set('Get Price of Item', getPrice);
  // intentMap.set('your intent name here', googleAssistantHandler);
  agent.handleRequest(intentMap);
});
