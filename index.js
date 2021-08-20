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
    scoopPrice = snapshot.val().scoopPrice;
    sugarPrice = snapshot.val().sugarPrice;
    toppingPrice = snapshot.val().toppingPrice;
    wafflePrice = snapshot.val().wafflePrice;
});
var myTotalPrice, myOrders;
firebaseAdmin.database().ref('Order').on('value', function(snapshot){
  myTotalPrice = snapshot.val().totalPrice;
  myOrders = snapshot.val().parts;
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
    " Let me know if you would like to add or delete any toppings.");
    const thisOrder = [{ container: container, flavor: flavor, numScoops: scoops, toppings: toppings, totalPrice: price}];
    let combined = [].concat(myOrders, thisOrder);
    firebaseAdmin.database().ref('Order').set({
      parts: combined,
      totalPrice: myTotalPrice + price
    });
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
    for(let x = 1; x < myOrders.length; x++)
    {
      agent.add('Order #' + x + ': ' + myOrders[x].numScoops + ' scoops of ' + myOrders[x].flavor + ' ice cream in a ' +
      myOrders[x].container + ' with ' + myOrders[x].toppings);
    }
    agent.add('The total cost of this order is $' + myTotalPrice);
  }

  function deleteOrder(agent) {
    const orderNums = agent.parameters.orderNum;
    for(let x = 0; x<orderNums.length; x++) {
      myTotalPrice -= myOrders[orderNums[x]].totalPrice;
      myOrders[orderNums[x]].flavor = "remove";
    }
    for(let y = 0; y<myOrders.length; y++) {
      if(myOrders[y].flavor == "remove") {
        myOrders.splice(y, 1);
        y--;
      }
    }
    firebaseAdmin.database().ref('Order').update({
      parts: myOrders,
      totalPrice: myTotalPrice
    });
    agent.add('Orders ' + orderNums + ' have been deleted!');
  }

  function addToppings(agent) {
    let toppings = agent.parameters.toppings, orderNum = agent.parameters.orderNum, thisPrice, thisToppings;
    firebaseAdmin.database().ref('Order/parts/'+orderNum).on('value', function(snapshot){
      thisPrice = snapshot.val().totalPrice;
      thisToppings = snapshot.val().toppings;
    });
    if(orderNum > 0 && orderNum < myOrders.length){
      myTotalPrice = myTotalPrice + (toppingPrice*toppings.length);
      firebaseAdmin.database().ref('Order').update({
        totalPrice: myTotalPrice
      });
      thisPrice = thisPrice + (toppingPrice*toppings.length);
      let combined = [].concat(thisToppings, toppings);
      firebaseAdmin.database().ref('Order/parts/'+orderNum).update({
        toppings: combined,
        totalPrice: thisPrice
      });
      agent.add(toppings + ' added to your order! Your total price is now $' + myTotalPrice);
    }
  }

  function removeToppings(agent) {
    let currentToppings, thisPrice, toppings = agent.parameters.toppings, orderNum = agent.parameters.orderNum;
    firebaseAdmin.database().ref('Order/parts/' + orderNum).on('value', function(snapshot){
      currentToppings = snapshot.val().toppings;
      thisPrice = snapshot.val().totalPrice;
    });
    for(let x = 0; x < currentToppings.length; x++) {
      for(let y = 0; y < toppings.length; y++) {
        if(currentToppings[x] === toppings[y]) {
          currentToppings.splice(x, 1);
          myTotalPrice -= toppingPrice;
          thisPrice -= toppingPrice;
          x--;
        }
      }
    }
    firebaseAdmin.database().ref('Order').update({
      totalPrice: myTotalPrice,
    });
    firebaseAdmin.database().ref('Order/parts/'+orderNum).update({
      toppings: currentToppings,
      totalPrice: thisPrice
    });
    agent.add(toppings + ' removed! The price of your order is now $' + myTotalPrice);
  }

  function finishOrder(agent) {
    agent.add('Great! Proceeding to checkout... your final order costs $' + myTotalPrice);
    firebaseAdmin.database().ref('Order').set({
      parts: [""],
      totalPrice: 0
    });
  }
  // Run the proper function handler based on the matched Dialogflow intent name
  let intentMap = new Map();
  intentMap.set('Order Ice Cream', order);
  intentMap.set('Get Price of Item', getPrice);
  intentMap.set('Request Order', orderSpecifics);
  intentMap.set('Delete Order', deleteOrder);
  intentMap.set('Add Toppings', addToppings);
  intentMap.set('Remove Toppings', removeToppings);
  intentMap.set('Finished Order', finishOrder);
  // intentMap.set('your intent name here', googleAssistantHandler);
  agent.handleRequest(intentMap);
});
