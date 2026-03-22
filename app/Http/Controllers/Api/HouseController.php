<?php

namespace App\Http\Controllers\Api;

use App\Actions\House\JoinHouseByQRCode;
use App\Http\Controllers\Controller;
use App\Actions\Houses\CreateHouse;
use App\Actions\Houses\JoinHouse;
use App\Http\Requests\CreateHouseRequest;
use Illuminate\Foundation\Auth\Access\AuthorizesRequests;
use App\Models\House;
use Illuminate\Http\Request;

class HouseController extends Controller
{
     use AuthorizesRequests;
    public function create(CreateHouseRequest $request, CreateHouse $action)
    {
        $house = $action->handle($request->validated(), $request->user());
        return response()->json($house);
    }

    public function join(Request $request, JoinHouse $action)
    {
        $house = $action->handle($request->code, $request->user());
        return response()->json($house);
    }

    public function show(House $house)
    {
        // Load mates and categories
        $house->load('mates', 'categories');

        return response()->json([
            'id' => $house->id,
            'name' => $house->name,
            'currency' => $house->currency ?? '$',
            'mates' => $house->mates->map(fn($mate) => [
                'id' => $mate->id,
                'name' => $mate->name,
                'role' => $mate->role,
            ]),
            'categories' => $house->categories->map(fn($cat) => [
                'id' => $cat->id,
                'name' => $cat->name,
                'icon' => $cat->icon,
            ]),
        ]);
    }

    public function update(Request $request, $id)
    {
        $house = House::findOrFail($id);

        $this->authorize('update', $house); // optional: ensure user can edit

        $house->update($request->only(['name', 'currency']));
        return response()->json($house);
    }

    public function joinByQRCode(Request $request, JoinHouseByQRCode $action)
    {
        $request->validate([
            'code' => 'required|string|exists:houses,code',
        ]);

        $user = auth()->user();

        $house = $action->execute($user, $request->code);

        return response()->json([
            'message' => 'Joined house successfully',
            'house' => $house
        ]);
    }

    public function current(Request $request)
    {
        $user = $request->user();
        $house = $user->house; // assuming user has house() relation

        if (!$house) {
            return response()->json([
                'house' => null,
            ]);
        }

        return response()->json([
            'house' => [
                'id' => $house->id,
                'name' => $house->name,
                'house_code' => $house->code,
            ]
        ]);
    }
}