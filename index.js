'use strict';
 
const functions = require('firebase-functions');
const {WebhookClient} = require('dialogflow-fulfillment');
const {Card, Suggestion} = require('dialogflow-fulfillment');
const firebaseAdmin = require('firebase-admin');

process.env.DEBUG = 'dialogflow:debug'; // enables lib debugging statements

firebaseAdmin.initializeApp({
    credential: firebaseAdmin.credential.applicationDefault(),
    databaseURL: 'ws://ice-cream-service-gjon-default-rtdb.firebaseio.com/'
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
var myContainer, myFlavor, myNumScoops, myToppings, myTotalPrice;
firebaseAdmin.database().ref('Order').on('value', function(snapshot){
  myContainer = snapshot.val().container;
});
firebaseAdmin.database().ref('Order').on('value', function(snapshot){
  myFlavor = snapshot.val().flavor;
});
firebaseAdmin.database().ref('Order').on('value', function(snapshot){
  myNumScoops = snapshot.val().numScoops;
});
firebaseAdmin.database().ref('Order').on('value', function(snapshot){
  myToppings = snapshot.val().toppings;
});
firebaseAdmin.database().ref('Order').on('value', function(snapshot){
  myTotalPrice = snapshot.val().totalPrice;
});
exports.dialogflowFirebaseFulfillment = functions.https.onRequest((request, response) => {
  const agent = new WebhookClient({ request, response });
  console.log('Dialogflow Request headers: ' + JSON.stringify(request.headers));
  console.log('Dialogflow Request body: ' + JSON.stringify(request.body));

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
    " This order will cost $" + price + ". Let me know if you would like to add or delete any toppings.");
    firebaseAdmin.database().ref('Order').set({
      container: container,
      flavor: flavor,
      numScoops: scoops,
      toppings: toppings,
      totalPrice: price
    });
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
      if(item === 'topping')
        price = toppingPrice;
      agent.add('The price of each ' + item + ' is $' + price + '.');
  }

  function orderSpecifics(agent) {
    agent.add('Your order consists of ' + myNumScoops + ' scoops of ' + myFlavor + ' ice cream in a ' + myContainer + ' with ' +
    myToppings + '. The total price is $' + myTotalPrice);
  }

  function deleteOrder(agent) {
    firebaseAdmin.database().ref('Order').set({
      container: '',
      flavor: '',
      numScoops: 0,
      toppings: [""],
      totalPrice: 0
    });
    agent.add('Order Deleted!');
  }

  function addToppings(agent) {
    let toppings = agent.parameters.toppings;
    for(let x = 0; x < toppings.length; x++)
      myTotalPrice += toppingPrice;
    let combined = [].concat(myToppings, toppings);
    firebaseAdmin.database().ref('Order').update({
      toppings: combined,
      totalPrice: myTotalPrice
    });
    agent.add(toppings + ' added to your order! Your total price is now $' + myTotalPrice);
  }

  function removeToppings(agent) {
    let currentToppings, toppings = agent.parameters.toppings;
    firebaseAdmin.database().ref('Order').on('value', function(snapshot){
      currentToppings = snapshot.val().toppings;
    });
    for(let x = 0; x < currentToppings.length; x++) {
      for(let y = 0; y < toppings.length; y++) {
        if(currentToppings[x] === toppings[y]) {
          currentToppings.splice(x, 1);
          myTotalPrice -= toppingPrice;
          x--;
        }
      }
    }
    firebaseAdmin.database().ref('Order').update({
      toppings: currentToppings,
      totalPrice: myTotalPrice,
    });
    agent.add(toppings + ' removed! The price of your order is now $' + myTotalPrice);
  }

  function finishOrder(agent) {
    agent.add('Great! Proceeding to checkout... your final order costs $' + myTotalPrice);
    firebaseAdmin.database().ref('Order').update({
      container: "",
      flavor: "",
      numScoops: 0,
      toppings: [""],
      totalPrice: 0
    });
  }
  // Run the proper function handler based on the matched Dialogflow intent name
  let intentMap = new Map();
  intentMap.set('Order Ice Cream', order);
  intentMap.set('Change Price', priceChange);
  intentMap.set('Get Price of Item', getPrice);
  intentMap.set('Request Order', orderSpecifics);
  intentMap.set('Delete Order', deleteOrder);
  intentMap.set('Add Toppings', addToppings);
  intentMap.set('Remove Toppings', removeToppings);
  intentMap.set('Finished Order', finishOrder);
  // intentMap.set('your intent name here', googleAssistantHandler);
  agent.handleRequest(intentMap);
});
