from django.test import TestCase
from .models import StockItem

class StockItemModelTest(TestCase):
    def setUp(self):
        StockItem.objects.create(name="Tomatoes", quantity=100, unit_price=0.5)
        StockItem.objects.create(name="Lettuce", quantity=50, unit_price=0.3)

    def test_stock_item_creation(self):
        tomatoes = StockItem.objects.get(name="Tomatoes")
        lettuce = StockItem.objects.get(name="Lettuce")
        self.assertEqual(tomatoes.quantity, 100)
        self.assertEqual(lettuce.unit_price, 0.3)

    def test_stock_item_str(self):
        item = StockItem.objects.get(name="Tomatoes")
        self.assertEqual(str(item), "Tomatoes")