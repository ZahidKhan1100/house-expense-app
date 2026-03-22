<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\CreateRecordRequest;
use App\Http\Requests\UpdateRecordRequest;
use App\Actions\Expenses\AddRecord;
use App\Actions\Expenses\UpdateRecord;
use App\Models\Record;
use Illuminate\Foundation\Auth\Access\AuthorizesRequests;

class RecordController extends Controller
{
    use AuthorizesRequests;
    public function store(CreateRecordRequest $request, AddRecord $action)
    {
        $record = $action->handle(auth()->user(), $request->validated());
        return response()->json($record, 201);
    }

    public function update(UpdateRecordRequest $request, Record $record, UpdateRecord $action)
    {
        $this->authorize('update', $record);

        $updated = $action->handle(auth()->user(), $record, $request->validated());

        return response()->json($updated);
    }

    public function destroy(Record $record)
    {
        $this->authorize('delete', $record);
        $record->delete();

        return response()->json(['message' => 'Record deleted']);
    }
}