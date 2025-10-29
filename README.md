# Blackjack Game

A full-stack multiplayer blackjack game built with React, Node.js, Socket.IO, and MongoDB.

## Features

- **Multiplayer Gameplay**: Real-time multiplayer blackjack with up to 6 players per room
- **User Authentication**: Secure JWT-based authentication system
- **Game Statistics**: Track wins, losses, and earnings
- **Leaderboard**: Global leaderboard system
- **Real-time Communication**: Socket.IO for instant game updates
- **Responsive Design**: Modern UI with Tailwind CSS
- **Sound Effects**: Interactive audio feedback
- **Admin Controls**: Room management and game administration

## Tech Stack

### Frontend
- React 18
- Vite
- Tailwind CSS
- Socket.IO Client
- Lucide React Icons
- Radix UI Components

### Backend
- Node.js
- Express.js
- Socket.IO
- MongoDB with Mongoose
- JWT Authentication
- bcryptjs for password hashing

## Local Development

### Prerequisites
- Node.js (v16 or higher)
- MongoDB (local or cloud instance)
- Git

### Installation

1. Clone the repository:
```bash
git clone <your-github-repo-url>
cd blackjack-game
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
```bash
cp .env.example .env
```

Edit `.env` with your configuration:
```env
PORT=5000
MONGODB_URI=mongodb://localhost:27017/blackjack
JWT_SECRET=your-super-secret-jwt-key
VITE_API_URL=http://localhost:5000
VITE_SOCKET_URL=http://localhost:5000
```

4. Start the development servers:
```bash
# Start both frontend and backend
npm run dev

# Or start them separately:
# Backend only
npm run server

# Frontend only
npm run client
```

5. Open your browser and navigate to `http://localhost:5173`

## Deployment on Render

### Prerequisites
- GitHub account
- Render account (free tier available)
- MongoDB Atlas account (for cloud database)

### Step 1: Prepare Your Repository

1. Push your code to GitHub:
```bash
git remote add origin <your-github-repo-url>
git branch -M main
git push -u origin main
```

### Step 2: Set up MongoDB Atlas

1. Create a MongoDB Atlas account at https://www.mongodb.com/atlas
2. Create a new cluster (free tier available)
3. Create a database user and get your connection string
4. Whitelist all IP addresses (0.0.0.0/0) for Render deployment

### Step 3: Deploy on Render

1. **Connect GitHub Repository**:
   - Go to https://render.com and sign up/login
   - Click "New +" and select "Blueprint"
   - Connect your GitHub account and select your repository

2. **Configure Environment Variables**:
   - In your Render dashboard, go to your web service
   - Add the following environment variables:
     - `MONGODB_URI`: Your MongoDB Atlas connection string
     - `JWT_SECRET`: A secure random string (generate one at https://generate-secret.vercel.app/32)

3. **Deploy**:
   - Render will automatically deploy both services using the `render.yaml` configuration
   - The backend will be available at: `https://blackjack-server.onrender.com`
   - The frontend will be available at: `https://blackjack-frontend.onrender.com`

### Step 4: Connect Your Custom Domain

1. **In Render Dashboard**:
   - Go to your frontend static site service
   - Navigate to "Settings" → "Custom Domains"
   - Click "Add Custom Domain"
   - Enter your domain name (e.g., `yourdomain.com`)

2. **Configure DNS**:
   - In your domain registrar's DNS settings, add a CNAME record:
     - Name: `@` (or `www`)
     - Value: `blackjack-frontend.onrender.com`
   - Wait for DNS propagation (can take up to 48 hours)

3. **SSL Certificate**:
   - Render automatically provides SSL certificates for custom domains
   - Your site will be available at `https://yourdomain.com`

## Environment Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `PORT` | Server port | `5000` |
| `MONGODB_URI` | MongoDB connection string | `mongodb+srv://user:pass@cluster.mongodb.net/blackjack` |
| `JWT_SECRET` | JWT signing secret | `your-super-secret-key` |
| `VITE_API_URL` | Frontend API URL | `https://blackjack-server.onrender.com` |
| `VITE_SOCKET_URL` | Frontend Socket.IO URL | `https://blackjack-server.onrender.com` |

## Game Rules

- Standard blackjack rules apply
- Dealer stands on 17
- Blackjack pays 3:2
- Insurance available when dealer shows Ace
- Double down on any two cards
- Split pairs (up to 3 hands)
- Surrender available

## API Endpoints

### Authentication
- `POST /api/auth/signup` - User registration
- `POST /api/auth/login` - User login
- `POST /api/auth/logout` - User logout
- `GET /api/auth/user` - Get current user

### Game
- `POST /api/game/create-room` - Create game room
- `POST /api/game/join-room` - Join game room
- `POST /api/game/track-stats` - Update game statistics

### Leaderboard
- `GET /api/leaderboard` - Get leaderboard data

## Socket Events

### Client to Server
- `join-room` - Join a game room
- `leave-room` - Leave current room
- `place-bet` - Place a bet
- `hit` - Request another card
- `stand` - End turn
- `double-down` - Double bet and take one card
- `split` - Split a pair
- `surrender` - Surrender hand

### Server to Client
- `room-joined` - Confirmation of room join
- `game-state` - Current game state
- `round-started` - New round begins
- `round-ended` - Round results
- `player-action` - Player action update
- `error` - Error messages

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature-name`
3. Commit your changes: `git commit -am 'Add feature'`
4. Push to the branch: `git push origin feature-name`
5. Submit a pull request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Support

For support or questions, please open an issue on GitHub or contact the development team.