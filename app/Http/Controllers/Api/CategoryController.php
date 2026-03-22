<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use App\Models\Category;
use App\Actions\Expenses\ManageCategory;

class CategoryController extends Controller
{
    public function index(Request $request)
    {
        $user = $request->user();
        $house = $user->house;

        if (!$house) {
            return response()->json([]);
        }

        $categories = $house->categories()->get(['id', 'name', 'icon']);

        return response()->json($categories);
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'name' => 'required|string|max:255',
            'icon' => 'required|string|max:50',
        ]);

        $user = $request->user();
        $house = $user->house;

        if (!$house) {
            return response()->json(['error' => 'No house assigned'], 403);
        }

        $category = ManageCategory::create($house, $data);

        return response()->json($category, 201);
    }

    public function update(Request $request, Category $category)
    {
        $data = $request->validate([
            'name' => 'required|string|max:255',
            'icon' => 'required|string|max:50',
        ]);

        $user = $request->user();
        $house = $user->house;

        if ($category->house_id !== $house->id) {
            return response()->json(['error' => 'Unauthorized'], 403);
        }

        $category = ManageCategory::update($category, $data);

        return response()->json($category);
    }

    public function destroy(Request $request, Category $category)
    {
        $user = $request->user();
        $house = $user->house;

        if ($category->house_id !== $house->id) {
            return response()->json(['error' => 'Unauthorized'], 403);
        }

        $category->delete();

        return response()->json(['message' => 'Category deleted']);
    }
}