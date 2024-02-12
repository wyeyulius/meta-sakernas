<?php

namespace App\Http\Controllers;

use App\Models\Response;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Illuminate\Support\Facades\Redirect;

class FormController extends Controller
{
    /**
     * Display a listing of the resource.
     */
    public function index()
    {
        $pml = auth()->user()->name ;
        return Inertia::render('Form', [
            "region" =>[
                [
                    "dataKey" =>"prov",
                    "answer" => "[71] SULAWESI UTARA"
                ],
                [
                    "dataKey" =>"kab",
                    "answer" => "[01] BOLAANG MONGONDOW"
                ],
                [
                    "dataKey" =>"kec",
                    "answer" => "[021] DUMOGA BARAT"
                ],
                [
                    "dataKey" =>"desa",
                    "answer" => "[005] DOLODUO"
                ],
                [
                    "dataKey" =>"nbs",
                    "answer" => "002B"
                ],              
                [
                    "dataKey" =>"nks",
                    "answer" => "15002"
                ],  
                [
                    "dataKey" =>"pml",
                    "answer" => $pml
                ],  
            ]
        ]);
    }

    /**
     * Show the form for creating a new resource.
     */
    public function create()
    {
        //
    }

    /**
     * Store a newly created resource in storage.
     */
    public function store(Request $request)
    {
        $req = $request->all();
        $answers = $req['answers'];
        $jumlah_art = $answers[9]['answer'];
        // dd($answers);
        for($i = 0; $i<$jumlah_art; $i++){
            $response = new Response();
            $response->id_bs = '1';
            $response->nurt = $answers[6]['answer'];
            $response->no_art = $i + 1;
            $no_urut = '#'.($i+1);
            foreach($answers as $key => $answer){
                if(str_ends_with($answer['dataKey'], $no_urut)){
                    $dk = rtrim($answer['dataKey'], $no_urut);
                    $response->$dk = $answer['answer'];
                }
            }
            $response->save();
        }
        return Redirect::to('/');

    }

    /**
     * Display the specified resource.
     */
    public function show(string $id)
    {
        //
    }

    /**
     * Show the form for editing the specified resource.
     */
    public function edit(string $id)
    {
        //
    }

    /**
     * Update the specified resource in storage.
     */
    public function update(Request $request, string $id)
    {
        //
    }

    /**
     * Remove the specified resource from storage.
     */
    public function destroy(string $id)
    {
        //
    }
}
