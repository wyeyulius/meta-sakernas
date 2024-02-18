<?php

namespace App\Http\Controllers;

use App\Models\Response;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Illuminate\Support\Facades\Redirect;
use App\Models\Region;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use stdClass;

class FormController extends Controller
{
    /**
     * Display a listing of the resource.
     */
    public function index(?string $region_id = null)
    {

        $pml = auth()->user()->name ;
        $kabupaten = Region::all()->where('kabupaten', auth()->user()->kabupaten)->unique('kabupaten')->map(fn($kabupaten) =>[
            'id' => $kabupaten->kabupaten,
            'nama' => '['.$kabupaten->kabupaten.'] '.$kabupaten->nama_kabupaten
        ]);
        $data = DB::table('responses')
                    ->select('region_id','nurt', 'created_at', DB::raw('count(*) as jumlah_art'))
                    ->groupByRaw('region_id, nurt, created_at')
                    ->where('region_id', '=', $region_id)
                    ->where('pml', '=', $pml)
                    ->get();
        return Inertia::render('Form/Index', [
            "kabupatens" => $kabupaten,
            "data" => $data
        ]);
    }

    /**
     * Show the form for creating a new resource.
     */
    public function create(string $region_id)
    {
        // dd ($request->all());
        $pml = auth()->user()->name ;
        $idbs = $region_id;
        // $pcl = User::all()->where('kabupaten', $region_id)->where('status', '2')->map(fn($pcl) =>[
        //     "label" => $pcl->name,
        //     "value" => $pcl->name,
        // ]);
        $kab = DB::scalar(
            "select kabupaten from regions where id =" . $region_id
        );
        if ($kab != auth()->user()->kabupaten) {
            return inertia_location('/');
        }
        $res = DB::table('responses')
                    ->select('nurt as label', 'nurt as value')
                    ->where('region_id','=', $region_id)
                    ->get()->toArray();
        $res = json_decode(json_encode($res), true);
        $nurt = [
            [
                'label' => "1",
                'value' => "1"
            ],
            [
                'label' => "2",
                'value' => "2"
            ],
            [
                'label' => "3",
                'value' => "3"
            ],
            [
                'label' => "4",
                'value' => "4"
            ],
            [
                'label' => "5",
                'value' => "5"
            ],
            [
                'label' => "6",
                'value' => "6"
            ],
            [
                'label' => "7",
                'value' => "7"
            ],
            [
                'label' => "8",
                'value' => "8"
            ],
            [
                'label' => "9",
                'value' => "9"
            ],
            [
                'label' => "10",
                'value' => "10"
            ]
         ];
        //  $nurt_done = array_diff($nurt, $res);
         foreach($nurt as $key => $n){
            foreach($res as $r){
                if($n['value'] == $r['value']){
                    unset($nurt[$key]);
                }
            }
         }

         $nurt = array_values($nurt);


        $pcl = DB::table('users')
                    ->select('name as label', 'name as value')
                    ->where('kabupaten','=', $kab)
                    ->where('status', '=', '2')
                    ->get();
        $prefill = Region::all()->where('id', $idbs)->map(fn($prefill) =>[
            [
                "dataKey" =>"prov",
                "answer" => '['.$prefill->provinsi.'] '.$prefill->nama_provinsi
            ],
            [
                "dataKey" =>"kab",
                "answer" => '['.$prefill->kabupaten.'] '.$prefill->nama_kabupaten
            ],
            [
                "dataKey" =>"kec",
                "answer" => '['.$prefill->kecamatan.'] '.$prefill->nama_kecamatan
            ],
            [
                "dataKey" =>"desa",
                "answer" => '['.$prefill->desa.'] '.$prefill->nama_desa
            ],
            [
                "dataKey" =>"nbs",
                "answer" => $prefill->nbs
            ],
            [
                "dataKey" =>"nks",
                "answer" => $prefill->nks
            ],
            [
                "dataKey" =>"pml",
                "answer" => $pml
            ],
        ]);
        $region_id = $region_id;

        return Inertia::render('Form/Entri', [
            "prefill" => $prefill,
            "region_id" => $region_id,
            'pcl' => $pcl,
            'nurt' => $nurt
        ]);

    }

    /**
     * Store a newly created resource in storage.
     */
    public function store(Request $request, string $region_id)
    {
        $req = $request->all();
        $answers = $req['answers'];
        $jumlah_art = $answers[9]['answer'];

        for($i = 0; $i<$jumlah_art; $i++){
            $response = new Response();
            $response->region_id = $region_id;
            $response->nurt = $answers[6]['answer'][0]['value'];
            $response->pcl = $answers[7]['answer'][0]['value'];
            $response->pml = $answers[8]['answer'];
            $response->no_art = $i + 1;
            $no_urut = '#'.($i+1);
            foreach($answers as $key => $answer){
                if(str_ends_with($answer['dataKey'], $no_urut)){
                    $dk = rtrim($answer['dataKey'], $no_urut);
                    $response->$dk = strval($answer['answer']);
                }
            }
            $response->save();
        }
        return inertia_location('/');

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
    public function edit(string $region_id, string $id)
    {
        $pml = auth()->user()->name ;
        $idbs = $region_id;
        // $pcl = User::all()->where('kabupaten', $region_id)->where('status', '2')->map(fn($pcl) =>[
        //     "label" => $pcl->name,
        //     "value" => $pcl->name,
        // ]);
        $kab = DB::scalar(
            "select kabupaten from regions where id =" . $region_id
        );
        if ($kab != auth()->user()->kabupaten) {
            return inertia_location('/');
        }
        $res = DB::table('responses')
                    ->select('nurt as label', 'nurt as value')
                    ->where('region_id','=', $region_id)
                    ->where('nurt', '!=', $id)
                    ->get()->toArray();
        $res = json_decode(json_encode($res), true);
        $nurt = [
            [
                'label' => "1",
                'value' => "1"
            ],
            [
                'label' => "2",
                'value' => "2"
            ],
            [
                'label' => "3",
                'value' => "3"
            ],
            [
                'label' => "4",
                'value' => "4"
            ],
            [
                'label' => "5",
                'value' => "5"
            ],
            [
                'label' => "6",
                'value' => "6"
            ],
            [
                'label' => "7",
                'value' => "7"
            ],
            [
                'label' => "8",
                'value' => "8"
            ],
            [
                'label' => "9",
                'value' => "9"
            ],
            [
                'label' => "10",
                'value' => "10"
            ]
         ];
        //  $nurt_done = array_diff($nurt, $res);
         foreach($nurt as $key => $n){
            foreach($res as $r){
                if($n['value'] == $r['value']){
                    unset($nurt[$key]);
                }
            }
         }

        $nurt = array_values($nurt);


        $pcl = DB::table('users')
                    ->select('name as label', 'name as value')
                    ->where('kabupaten','=', $kab)
                    ->where('status', '=', '2')
                    ->get();

        $response = [];
        $data = DB::table('responses')
                    ->where('region_id', '=', $region_id)
                    ->where('pml', '=', $pml)
                    ->where('nurt', "=", $id )
                    ->get();
        $field = array('id', 'region_id', 'pcl', 'pml', 'nurt', 'no_art');
        $response = [
            [
                "dataKey" => "nurt",
                "answer" => [
                    [
                        "label" => $data[0]->nurt,
                        "value" => $data[0]->nurt
                    ]
                ]
            ],
            [
                "dataKey" => "pcl",
                "answer" => [
                    [
                        "label" => $data[0]->pcl,
                        "value" => $data[0]->pcl
                    ]
                ]
            ],
            [
                "dataKey" => "jml_art",
                "answer" => sizeof($data)
            ],
        ];

        foreach ($data as $k => $datum) {
            foreach ($datum as $key => $value) {
                    if (!in_array($key, $field) ) {
                        $r = [];
                        $r["dataKey"] = $key.'#'.$k+1;
                        $r["answer"] = $value;
                        $response [] = $r;
                    }
            }
        };
        // dd($response);

        $prefill = Region::all()->where('id', $idbs)->map(fn($prefill) =>[
            [
                "dataKey" =>"prov",
                "answer" => '['.$prefill->provinsi.'] '.$prefill->nama_provinsi
            ],
            [
                "dataKey" =>"kab",
                "answer" => '['.$prefill->kabupaten.'] '.$prefill->nama_kabupaten
            ],
            [
                "dataKey" =>"kec",
                "answer" => '['.$prefill->kecamatan.'] '.$prefill->nama_kecamatan
            ],
            [
                "dataKey" =>"desa",
                "answer" => '['.$prefill->desa.'] '.$prefill->nama_desa
            ],
            [
                "dataKey" =>"nbs",
                "answer" => $prefill->nbs
            ],
            [
                "dataKey" =>"nks",
                "answer" => $prefill->nks
            ],
            [
                "dataKey" =>"pml",
                "answer" => $pml
            ]
        ]);

        return Inertia::render('Form/Entri', [
            "prefill" => $prefill,
            "response" => $response,
            "region_id" => $region_id,
            'pcl' => $pcl,
            'nurt' => $nurt
        ]);

    }

    /**
     * Update the specified resource in storage.
     */
    public function update(Request $request, string $region_id, string $id)
    {
        $pml = auth()->user()->name ;
        Response::where('region_id', $region_id)->where('pml', '=', $pml)->where('nurt', $id)->delete();
        $req = $request->all();
        $answers = $req['answers'];
        $jumlah_art = $answers[9]['answer'];

        for($i = 0; $i<$jumlah_art; $i++){
            $response = new Response();
            $response->region_id = $region_id;
            $response->nurt = $answers[6]['answer'][0]['value'];
            $response->pcl = $answers[7]['answer'][0]['value'];
            $response->pml = $answers[8]['answer'];
            $response->no_art = $i + 1;
            $no_urut = '#'.($i+1);
            foreach($answers as $key => $answer){
                if(str_ends_with($answer['dataKey'], $no_urut)){
                    $dk = rtrim($answer['dataKey'], $no_urut);
                    $response->$dk = strval($answer['answer']);
                }
            }
            $response->save();
        }
        return inertia_location('/');
    }

    /**
     * Remove the specified resource from storage.
     */
    public function destroy(string $region_id, string $id)
    {
        $pml = auth()->user()->name ;
        Response::where('region_id', $region_id)->where('pml', '=', $pml)->where('nurt', $id)->delete();
        return redirect()->route('form.index');
    }
}
