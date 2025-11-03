from django.shortcuts import render
from django.http import JsonResponse
from .models import StockItem

def stock_list(request):
    items = StockItem.objects.all()
    return render(request, 'stock/stock_list.html', {'items': items})

def stock_detail(request, item_id):
    item = StockItem.objects.get(id=item_id)
    return render(request, 'stock/stock_detail.html', {'item': item})

def add_stock_item(request):
    if request.method == 'POST':
        # Logic to add a new stock item
        pass
    return render(request, 'stock/add_stock_item.html')

def update_stock_item(request, item_id):
    item = StockItem.objects.get(id=item_id)
    if request.method == 'POST':
        # Logic to update the stock item
        pass
    return render(request, 'stock/update_stock_item.html', {'item': item})

def delete_stock_item(request, item_id):
    item = StockItem.objects.get(id=item_id)
    if request.method == 'POST':
        item.delete()
        return JsonResponse({'success': True})
    return render(request, 'stock/delete_stock_item.html', {'item': item})
