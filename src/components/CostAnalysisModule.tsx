import React, { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';

interface CostItem {
  id: string;
  description: string;
  amount: number;
}

export const CostAnalysisModule: React.FC = () => {
  const [costItems, setCostItems] = useState<CostItem[]>([]);
  const [newItem, setNewItem] = useState({ description: '', amount: 0 });

  const addCostItem = () => {
    if (!newItem.description || newItem.amount <= 0) return;
    setCostItems([...costItems, { ...newItem, id: Date.now().toString() }]);
    setNewItem({ description: '', amount: 0 });
  };

  const removeCostItem = (id: string) => {
    setCostItems(costItems.filter(item => item.id !== id));
  };

  return (
    <div className="p-6 bg-white rounded-3xl shadow-sm border border-slate-100">
      <h3 className="text-lg font-bold mb-4">Diğer Maliyet Kalemleri</h3>
      
      <div className="flex gap-2 mb-4">
        <input 
          type="text" 
          placeholder="Maliyet Açıklaması" 
          className="flex-1 p-2 border rounded-xl text-sm"
          value={newItem.description}
          onChange={(e) => setNewItem({...newItem, description: e.target.value})}
        />
        <input 
          type="number" 
          placeholder="Tutar" 
          className="w-32 p-2 border rounded-xl text-sm"
          value={newItem.amount}
          onChange={(e) => setNewItem({...newItem, amount: parseFloat(e.target.value) || 0})}
        />
        <button onClick={addCostItem} className="bg-slate-900 text-white p-2 rounded-xl">
          <Plus size={20} />
        </button>
      </div>

      <div className="space-y-2">
        {costItems.map(item => (
          <div key={item.id} className="flex justify-between items-center p-3 bg-slate-50 rounded-xl">
            <span className="text-sm font-medium">{item.description}</span>
            <div className="flex items-center gap-4">
              <span className="font-bold text-sm">${item.amount.toLocaleString()}</span>
              <button onClick={() => removeCostItem(item.id)} className="text-red-500">
                <Trash2 size={16} />
              </button>
            </div>
          </div>
        ))}
        <div className="pt-4 border-t flex justify-between font-bold text-sm">
          <span>Toplam Ek Maliyet</span>
          <span>${costItems.reduce((acc, curr) => acc + curr.amount, 0).toLocaleString()}</span>
        </div>
      </div>
    </div>
  );
};
