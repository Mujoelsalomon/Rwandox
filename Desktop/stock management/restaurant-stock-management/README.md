# Restaurant Stock Management System

This project is a stock management system designed specifically for restaurants. It allows users to manage stock items efficiently, providing functionalities for adding, updating, deleting, and retrieving stock information.

## Features

- **CRUD Operations**: Easily add, update, delete, and retrieve stock items.
- **TypeScript**: Built with TypeScript for better type safety and development experience.
- **Express Framework**: Utilizes Express.js for handling HTTP requests and routing.

## Project Structure

```
restaurant-stock-management
├── src
│   ├── app.ts                # Entry point of the application
│   ├── controllers
│   │   └── stockController.ts # Handles stock-related operations
│   ├── models
│   │   └── stockItem.ts       # Defines the structure of stock items
│   ├── routes
│   │   └── stockRoutes.ts      # Sets up routes for stock management
│   └── types
│       └── index.ts           # Defines TypeScript interfaces
├── package.json               # NPM configuration file
├── tsconfig.json              # TypeScript configuration file
└── README.md                  # Project documentation
```

## Installation

1. Clone the repository:
   ```
   git clone <repository-url>
   ```
2. Navigate to the project directory:
   ```
   cd restaurant-stock-management
   ```
3. Install the dependencies:
   ```
   npm install
   ```

## Usage

1. Start the application:
   ```
   npm start
   ```
2. Access the API at `http://localhost:3000`.

## API Endpoints

- `POST /stock` - Add a new stock item
- `PUT /stock/:id` - Update an existing stock item
- `DELETE /stock/:id` - Delete a stock item
- `GET /stock` - Retrieve all stock items
- `GET /stock/:id` - Retrieve a specific stock item by ID

## Contributing

Contributions are welcome! Please open an issue or submit a pull request for any improvements or bug fixes.

## License

This project is licensed under the MIT License.