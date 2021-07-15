# Ice-Cream-Ordering-Service
First, go to dialogflow.cloud.google.com
Create an agent, and in the settings, find a tab that says 'Export and Import'. Click 'Import from ZIP'. Drag the Ice-Cream-Service.zip file into the box to import the dialogflow project.
Go into the fulfillment tab on the left side and enable the Inline Editor. Copy and paste the index.js file into the index.js tab of the editor. Copy and paste the package.json file as well.
Go to console.firebase.google.com and create a realtime database from your current project. Click the three dots at the top left of the database and click 'Import JSON'. Import ice-cream-service...json file into this. Copy and paste the link of the database and replace with the link in line 14 of index.js file. 
Go into the integrations tab on the left and enable the web demo. Your chatbot should be working now.
