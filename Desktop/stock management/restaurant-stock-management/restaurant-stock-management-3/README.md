# Restaurant Stock Management System

This project is a stock management system designed specifically for restaurants. It allows restaurant owners and managers to keep track of their inventory, manage stock levels, and ensure that they have the necessary ingredients on hand to meet customer demand.

## Features

- Manage stock levels for various ingredients and supplies.
- Track inventory usage and reorder points.
- User-friendly interface for easy management.
- Integration with Django admin for easy data management.

## Setup Instructions

1. **Clone the repository:**
   ```
   git clone <repository-url>
   cd restaurant-stock-management
   ```

2. **Create a virtual environment:**
   ```
   python -m venv venv
   source venv/bin/activate  # On Windows use `venv\Scripts\activate`
   ```

3. **Install the required packages:**
   ```
   pip install -r requirements.txt
   ```

4. **Run migrations:**
   ```
   python manage.py migrate
   ```

5. **Create a superuser (optional):**
   ```
   python manage.py createsuperuser
   ```

6. **Run the development server:**
   ```
   python manage.py runserver
   ```

## Usage

- Access the application at `http://127.0.0.1:8000/`.
- Use the Django admin interface at `http://127.0.0.1:8000/admin/` to manage stock items.

## Contributing

Contributions are welcome! Please open an issue or submit a pull request for any improvements or features you would like to add.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.