⚡ Sparky AI: Pro Edition

Powered by Nvidia DeepSeek | Engineered by Santosh Poojary
Sparky AI is a high-performance, private AI assistant interface. Unlike standard web-based chatbots, Sparky uses a Decoupled Architecture: a secure Node.js backend to handle API keys and a beautiful, "Anti-Gravity" CSS frontend for a premium user experience.

Quick Start Guide (For New Users)
Follow these steps to get Sparky up and running on your local machine.
 

//////////////////////////////////////  INSTALLATION //////////////////////////////////////////////////

1. Prerequisites (The Engine)
Before you can run Sparky, you need Node.js installed on your computer. This allows your computer to run the backend server.

      DOWNLOAD : https://nodejs.org/en

      Verify: Open your terminal/command prompt and type "[ node -v ]". If you see a version number, you're ready!

2A. Installation & Setup
Open Project: Open your Sparky project folder in Visual Studio Code.

Unlock PowerShell (Windows Only): If you get a "security error" when trying to run commands, paste this into your VS Code terminal and hit Enter: IN CMD PROMPT
      [  Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned  ]

2B. Install Dependencies: In your VS Code terminal, run: IN CMD PROMPT
      [  npm install express cors  
         npm install express-session
         npm install express cors express-session ]

You should see: 🚀 Sparky Backend Server is running on http://localhost:3000


/////TO STARTT/////

3A. Powering On Sparky
You must start the Backend Server before opening the website.

Start the Server: In the terminal, type: IN CMD PROMPT
      [  node server.js  ]

3B. Launch the UI: Open your browser (Chrome or Edge) and go to:
      [  http://localhost:3000/in.html  ]

You should see: 🚀 Sparky Backend Server is running on http://localhost:3000



////////////////////////////////////////////  FEATURES ////////////////////////////////////////////////////

Key Features
Persona Switcher: Toggle between Helpful Assistant, Senior Coder, and Sarcastic Wits via the dropdown.

Stream Buffering: Advanced logic to prevent "Thinking" freezes during high-speed data transfer.

Stop Button: Instantly abort an AI response if it begins rambling.

Regenerate: Not happy with an answer? Click the rotate icon to force a new attempt.

Dark Mode: Built-in theme engine that remembers your preference.


///////////////////////////////////////////  PROJECT STRUCTURE  ////////////////////////////////////////////////

* server.js: The "Brain." It handles security, API calls to Nvidia, and hosts the files.

* sparky.ai.html: The "Face." The entire UI, CSS animations, and streaming logic.

* node_modules/: Required folders created after running [  npm install  ].


///////////////////////////////////////////  IMPORTANT NOTES  ////////////////////////////////////////////////

⚠️ Important Notes
1.The Terminal Rule: Do NOT close the VS Code terminal while using Sparky.
 If the terminal closes, the AI loses its brain!

2.API Key: Your Nvidia API key is stored inside server.js.
 Keep this file private and do not share it on public websites like GitHub.

3.Browser: Always use the http://localhost:3000 link.
 Opening the file directly (file:///) will cause security errors.


///////////////////////////////////////////  SUPPORTT  ////////////////////////////////////////////////

Created by Santosh Poojary.
For inquiries or engineered enhancements, reach out via:

Email: santoshpoojary2004@gmail.com

Instagram: @xxiv.sparky


