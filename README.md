# Blackjack Multiplayer Game

This is a multiplayer Blackjack game that uses Node.js and Socket.IO for real-time communication.

## Setup Instructions

### Prerequisites
- Node.js (v14 or higher)
- MongoDB (local or Atlas)

### Installation

1. Clone the repository
2. Install dependencies:
```
npm install
```

3. Create a `.env` file in the root directory with the following variables:
```
PORT=5000
MONGODB_URI=mongodb://localhost:27017/blackjack
JWT_SECRET=your_secret_key
```

4. Start the development server:
```
npm run dev
```

This will start both the Node.js backend server and the Vite frontend development server.

## Features

- Real-time multiplayer Blackjack
- Chat functionality
- User authentication
- Leaderboard
- Practice mode

## Game Rules

Standard Blackjack rules apply:
- Get as close to 21 as possible without going over
- Face cards are worth 10, Aces are worth 1 or 11
- Dealer must hit on 16 or less and stand on 17 or more

## Technologies Used

- Frontend: React, Vite, Framer Motion
- Backend: Node.js, Express, Socket.IO
- Database: MongoDB with Mongoose
- Authentication: JWT

## Converting from Supabase

This project was converted from using Supabase to a self-hosted Node.js and Socket.IO solution. The conversion maintains all the original game logic, design, and features while allowing for self-hosting.