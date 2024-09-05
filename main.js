var input_probs = IVAN_PROBS;
const OUTPUT_W = 20;
const OUTPUT_H = 20;

$("#container")[0].style.width=OUTPUT_W*16+"px"
$("#wfcResultContainer")[0].style.width=OUTPUT_W*16+"px"

function show_ruler(){
    var html=""
    for(var i=0; i<OUTPUT_W; i++){
        for(var j=0; j<OUTPUT_H; j++){
            if(i==0){
                html+='<div style="text-align:center; position: absolute; top:'+i*16+'px; left: '+(j*1+1)*16+'px; width: 16px; height: 16px;">'+j+'</div>'
            }
        }
        html+='<div style="text-align:center; position: absolute; top:'+(i*1+1)*16+'px; left: 0; width: 16px; height: 16px;">'+i+'</div>'
    }
    $("#container")[0].innerHTML+=html;
}
show_ruler()

//transform input_probs from list of tileids to bigintegers
for(ref_tile_id in input_probs){
    for(dir in input_probs[ref_tile_id]){
        var res = 0n
        for(tile_id of input_probs[ref_tile_id][dir]){
            res |= 1n << BigInt(tile_id)
        }
        input_probs[ref_tile_id][dir] = res
    }
}


var output = new Array();       //2d array of output tiles. -1 indicates superposition
var output_probs = new Array(); //output_probs is a 2d array of bigints: first two indexes are position (x/y), each position contains a bigint which is to be read as a bitmap.
var prob_calced_ctr = new Array();

const BIT_LOOKUP_TBL = [0,1,1,2,1,2,2,3,1,2,2,3,2,3,3,4] //for each index contains how many bits are set for that index value (e.g BIT_LOOKUP_TBL[3] = 2 because 3 is 0011)
function count_bits(input){
    var res = 0;
    while(input > 0){
        res += BIT_LOOKUP_TBL[input & 15n]
        input >>= 4n
    }
    return res
}

//takes in a biginter bitmap and converts it to int[]
function bitmap_to_tile_ids(input){
    //can probably be faster
    var out = new Array();
    var i=0;
    while (input != 0n){
        if ((input & 1n) === 1n){
            out.push(i)
        }
        i++;
        input >>= 1n;
    }
    return out
}

function get_nth_set_bit(input, n){
    var i=0;
    while (input != 0n){
        if ((input & 1n) === 1n){
            if(n == 0){
                return BigInt(i);
            }
            n--;
        }
        i++;
        input >>= 1n;
    }
    throw new Error('Out of bounds');
}

//all possibilities accounted
var probs_tmpl = (1n << BigInt(Object.keys(IVAN_PROBS).length))-1n

function init(){
    //init arrays
    for(var i=0; i<OUTPUT_W; i++){
        output_probs[i] = new Array();
        output[i] = new Array();
        prob_calced_ctr[i] = new Array();
        for(var j=0; j<OUTPUT_H; j++){
            output_probs[i][j] = probs_tmpl
            output[i][j] = -1;
            prob_calced_ctr[i][j] = false;
        }
    }
}

//finds the cell with the lowest non-zero (not-yet-collapsed) amount of possibilities
function find_lowest_entropy_cell(){
    var lowestI = -1;
    var lowestJ = -1;
    var lowestCnt = count_bits(probs_tmpl) + 1*1;
    for(var i=0; i<OUTPUT_W; i++){
        for(var j=0; j<OUTPUT_H; j++){
            var bitsNo=count_bits(output_probs[i][j]);
            if(output[i][j] == -1 && bitsNo<lowestCnt){
                lowestCnt = bitsNo;
                var lowestI = i;
                var lowestJ = j;
            }
        }
    }
    return [lowestI, lowestJ];
}

//recursively recomputes superpositions for all not-yet-collapsed tiles
function recalc_prob(x, y){
    if(x<0 || y<0 || x==OUTPUT_W || y==OUTPUT_H || prob_calced_ctr[x][y]){
        return
    }
    prob_calced_ctr[x][y] = true;
    if(output[x][y] != -1){
        recalc_prob(x-1, y  )
        recalc_prob(x+1, y  )
        recalc_prob(x  , y-1)
        recalc_prob(x  , y+1)
        return;
    }
    var l = new Array();
    var r = new Array();
    var u = new Array();
    var d = new Array();
    if(x>0)          {l=bitmap_to_tile_ids(output_probs[x-1][y  ])}
    if(x<OUTPUT_W-1) {r=bitmap_to_tile_ids(output_probs[x+1][y  ])}
    if(y>0)          {u=bitmap_to_tile_ids(output_probs[x  ][y-1])}
    if(y<OUTPUT_H-1) {d=bitmap_to_tile_ids(output_probs[x  ][y+1])}

    var l_allowed_tiles = 0n;
    for(tile of l){
        l_allowed_tiles = l_allowed_tiles | input_probs[""+tile].right
    }
    var r_allowed_tiles = 0n;
    for(tile of r){
        r_allowed_tiles = r_allowed_tiles | input_probs[""+tile].left
    }
    var u_allowed_tiles = 0n;
    for(tile of u){
        u_allowed_tiles = u_allowed_tiles | input_probs[""+tile].down
    }
    var d_allowed_tiles = 0n;
    for(tile of d){
        d_allowed_tiles = d_allowed_tiles | input_probs[""+tile].up
    }
    if(l.length == 0){l_allowed_tiles = probs_tmpl}
    if(r.length == 0){r_allowed_tiles = probs_tmpl}
    if(u.length == 0){u_allowed_tiles = probs_tmpl}
    if(d.length == 0){d_allowed_tiles = probs_tmpl}

    output_probs[x][y] = output_probs[x][y] & l_allowed_tiles;
    output_probs[x][y] = output_probs[x][y] & r_allowed_tiles;
    output_probs[x][y] = output_probs[x][y] & u_allowed_tiles;
    output_probs[x][y] = output_probs[x][y] & d_allowed_tiles;

    if(count_bits(output_probs[x][y]) != count_bits(probs_tmpl)){
        recalc_prob(x-1, y  )
        recalc_prob(x+1, y  )
        recalc_prob(x  , y-1)
        recalc_prob(x  , y+1)
    }

}   

function observe(x, y){
    var probs = output_probs[x][y]
    if(probs === 0n){
        throw new Error('Collision! Tile '+x+', '+y+' has 0 possibilities');
    }
    var i = Math.floor(Math.random() * count_bits(probs));
    output[x][y] = get_nth_set_bit(output_probs[x][y], i)
    output_probs[x][y] = 1n << output[x][y];

    //propagate changes to nearby nodes
    recalc_prob(x, y)

    //reset prob_calced_ctr
    for(var i=0; i<OUTPUT_W; i++){
        for(var j=0; j<OUTPUT_H; j++){
            prob_calced_ctr[i][j] = false;
        }
    }
    
}

function start(){
    init();
    var arr = find_lowest_entropy_cell();
    var x = arr[0];
    var y = arr[1];
    var k=0;
    do {
        try{
            observe(x,y);
            arr = find_lowest_entropy_cell();
            x = arr[0];
            y = arr[1];
        } catch (error){
            console.log("Error occourred, restarting")
            console.log(error);
            break;
            //restart
            init();
            arr = find_lowest_entropy_cell();
            x = arr[0];
            y = arr[1];
        }
        k++
    } while(x != -1 && y!= -1)
    console.log("done")
    var html = ""
    for(var i=0; i<OUTPUT_W; i++){
        for(var j=0; j<OUTPUT_H; j++){
            html += '<img src="img/provaIvan/tile'+output[j][i]+'.png" />'
        }
    }
    $("#wfcResultContainer")[0].innerHTML=html

}