<?php

namespace App\Actions\Expenses;

use App\Models\House;
use App\Models\Category;

class ManageCategory
{
    public static function create(House $house, array $data): Category
    {
        return $house->categories()->create([
            'name' => $data['name'],
            'icon' => $data['icon'],
        ]);
    }

    public static function update(Category $category, array $data): Category
    {
        $category->update([
            'name' => $data['name'],
            'icon' => $data['icon'],
        ]);

        return $category;
    }
}